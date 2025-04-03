const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;
const bcrypt = require('bcryptjs');

module.exports = (passport, prisma) => {
  // Local Strategy
  passport.use(
    new LocalStrategy(
      {
        usernameField: 'email',
        passwordField: 'password',
      },
      async (email, password, done) => {
        try {
          const user = await prisma.user.findUnique({
            where: { email },
            include: {
              roles: true,
              investor: true,
            },
          });

          if (!user) {
            return done(null, false, { message: 'Incorrect email.' });
          }

          if (!user.password_hash) {
            return done(null, false, { message: 'Please use Google login.' });
          }

          const isMatch = await bcrypt.compare(password, user.password_hash);
          if (!isMatch) {
            return done(null, false, { message: 'Incorrect password.' });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Google Strategy
  console.log('Configuring Google Strategy...');
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('Missing Google OAuth credentials in environment variables!');
      console.error('Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file');
    } else {
      console.log('Google OAuth credentials found in environment');
      
      passport.use(
        new GoogleStrategy(
          {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: '/api/auth/google/callback',
            passReqToCallback: true
          },
          async (req, accessToken, refreshToken, profile, done) => {
            try {
              // Check if user exists
              let user = await prisma.user.findUnique({
                where: { email: profile.emails[0].value },
                include: {
                  roles: true,
                  investor: true,
                  issuer: true,
                },
              });
    
              if (user) {
                // Check if Google auth provider exists
                const authProvider = await prisma.authProvider.findFirst({
                  where: {
                    user_id: user.id,
                    provider_name: 'google',
                    provider_user_id: profile.id,
                  },
                });
    
                if (!authProvider) {
                  // Create new auth provider
                  await prisma.authProvider.create({
                    data: {
                      user_id: user.id,
                      provider_name: 'google',
                      provider_user_id: profile.id,
                      provider_data: profile,
                    },
                  });
                }
    
                return done(null, user);
              }
    
              // Get role from session hint
              const roleHint = req.session?.rolehint?.toUpperCase();
              // Default role is investor if no hint or invalid hint
              const userRole = ['ISSUER', 'INVESTOR'].includes(roleHint) ? roleHint : 'INVESTOR';
              
              console.log(`Creating new user with role: ${userRole}`);
    
              // Create new user with role based on hint
              const userData = {
                email: profile.emails[0].value,
                first_name: profile.name.givenName,
                last_name: profile.name.familyName,
                email_verified: true,
                profile_image: profile.photos[0].value,
                roles: {
                  create: {
                    role: userRole,
                  },
                },
                auth_providers: {
                  create: {
                    provider_name: 'google',
                    provider_user_id: profile.id,
                    provider_data: profile,
                  },
                }
              };
              
              // Add role-specific data
              if (userRole === 'INVESTOR') {
                userData.investor = {
                  create: {
                    investor_type: 'INDIVIDUAL',
                    accreditation_status: 'PENDING',
                    kyc_verified: false,
                    aml_verified: false,
                  },
                };
              } else if (userRole === 'ISSUER') {
                // For issuers, we need a placeholder company name until they update it
                userData.issuer = {
                  create: {
                    company_name: `Company of ${profile.name.givenName} ${profile.name.familyName}`,
                    company_registration_number: 'PENDING',
                    jurisdiction: 'PENDING',
                    verification_status: false,
                  },
                };
              }
    
              // Create the user
              user = await prisma.user.create({
                data: userData,
                include: {
                  roles: true,
                  investor: userRole === 'INVESTOR' ? true : undefined,
                  issuer: userRole === 'ISSUER' ? true : undefined,
                },
              });
    
              return done(null, user);
            } catch (error) {
              console.error('Google Auth Error:', error);
              return done(error);
            }
          }
        )
      );
    }
  } catch (error) {
    console.error('Error setting up Google Strategy:', error);
  }

  // Twitter Strategy
  console.log('Configuring Twitter Strategy...');
  try {
    if (!process.env.TWITTER_CONSUMER_KEY || !process.env.TWITTER_CONSUMER_SECRET) {
      console.error('Missing Twitter OAuth credentials in environment variables!');
      console.error('Please set TWITTER_CONSUMER_KEY and TWITTER_CONSUMER_SECRET in your .env file');
    } else {
      console.log('Twitter OAuth credentials found in environment');
      
      passport.use(
        new TwitterStrategy(
          {
            consumerKey: process.env.TWITTER_CONSUMER_KEY,
            consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
            callbackURL: '/api/auth/twitter/callback',
            passReqToCallback: true
          },
          async (req, token, tokenSecret, profile, done) => {
            try {
              // Check if user exists by Twitter ID first
              let authProvider = await prisma.authProvider.findFirst({
                where: {
                  provider_name: 'twitter',
                  provider_user_id: profile.id,
                },
                include: {
                  user: {
                    include: {
                      roles: true,
                      investor: true,
                      issuer: true,
                    }
                  }
                }
              });

              if (authProvider) {
                return done(null, authProvider.user);
              }

              // Check if user exists by email (if email provided by Twitter)
              // Note: Twitter doesn't always provide email
              let user = null;
              const email = profile.emails?.[0]?.value;
              
              if (email) {
                user = await prisma.user.findUnique({
                  where: { email },
                  include: {
                    roles: true,
                    investor: true,
                    issuer: true,
                  },
                });
              }

              if (user) {
                // Create auth provider connection
                await prisma.authProvider.create({
                  data: {
                    user_id: user.id,
                    provider_name: 'twitter',
                    provider_user_id: profile.id,
                    provider_data: profile,
                  },
                });
                
                return done(null, user);
              }

              // Get role from session hint
              const roleHint = req.session?.rolehint?.toUpperCase();
              
              // Default role is INVESTOR if no hint provided
              const userRole = roleHint && ['ADMIN', 'ISSUER', 'INVESTOR'].includes(roleHint) 
                ? roleHint 
                : 'INVESTOR';
              
              // Create new user with their Twitter profile
              const names = profile.displayName.split(' ');
              const firstName = names[0] || 'Twitter';
              const lastName = names.length > 1 ? names[names.length - 1] : 'User';
              
              // Prepare user data
              const userData = {
                email: email || `twitter_${profile.id}@placeholder.com`,
                first_name: firstName,
                last_name: lastName,
                username: profile.username || `twitter_${profile.id}`,
                // Create the appropriate role
                roles: {
                  create: {
                    role: userRole
                  }
                }
              };
              
              // Add related entity based on role
              if (userRole === 'INVESTOR') {
                userData.investor = {
                  create: {
                    status: 'PENDING'
                  }
                };
              } else if (userRole === 'ISSUER') {
                userData.issuer = {
                  create: {
                    status: 'PENDING'
                  }
                };
              }
              
              // Create the user
              user = await prisma.user.create({
                data: userData,
                include: {
                  roles: true,
                  investor: userRole === 'INVESTOR' ? true : undefined,
                  issuer: userRole === 'ISSUER' ? true : undefined,
                },
              });
              
              // Create auth provider
              await prisma.authProvider.create({
                data: {
                  user_id: user.id,
                  provider_name: 'twitter',
                  provider_user_id: profile.id,
                  provider_data: profile,
                },
              });
              
              return done(null, user);
            } catch (error) {
              console.error('Twitter Auth Error:', error);
              return done(error);
            }
          }
        )
      );
    }
  } catch (error) {
    console.error('Error setting up Twitter Strategy:', error);
  }

  // Serialize user for the session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialize user from the session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          roles: true,
          investor: true,
        },
      });
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
}; 
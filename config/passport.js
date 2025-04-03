const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const bcrypt = require('bcryptjs');
const { JWT_SECRET, verifyToken } = require('./jwt');

module.exports = (passport, prisma) => {
  // JWT Strategy
  const jwtOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: JWT_SECRET,
    passReqToCallback: true
  };

  passport.use(new JwtStrategy(jwtOptions, async (req, jwt_payload, done) => {
    try {
      const user = await verifyToken(req.headers.authorization.split(' ')[1]);
      if (!user) {
        return done(null, false);
      }
      return done(null, user);
    } catch (error) {
      return done(error, false);
    }
  }));

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
              userrole: true,
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
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user exists
          let user = await prisma.user.findUnique({
            where: { email: profile.emails[0].value },
            include: {
              userrole: true,
              investor: true,
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

          // Create new user
          user = await prisma.user.create({
            data: {
              email: profile.emails[0].value,
              first_name: profile.name.givenName,
              last_name: profile.name.familyName,
              email_verified: true,
              profile_image: profile.photos[0].value,
              userrole: {
                create: {
                  role: 'INVESTOR',
                },
              },
              investor: {
                create: {
                  investor_type: 'INDIVIDUAL',
                  accreditation_status: 'PENDING',
                },
              },
              auth_providers: {
                create: {
                  provider_name: 'google',
                  provider_user_id: profile.id,
                  provider_data: profile,
                },
              },
            },
            include: {
              userrole: true,
              investor: true,
            },
          });

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

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
          userrole: true,
          investor: true,
        },
      });
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
}; 
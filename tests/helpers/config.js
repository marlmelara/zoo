// ============================================================
// Where the test suite is allowed to point, and nowhere else.
//
// `npm test` needs Node >= 22.6, where `node --test` learned to
// take glob patterns.
//
// Every test file builds and drops its own throwaway database,
// named `<prefix>_<scope>_test`. That keeps files independent —
// `node --test tests/oversell.test.js` works on its own, and
// node's default parallel file execution can't have two files
// clobbering one schema.
//
// The database must never be the developer's `coog_zoo` and never
// the Azure production server, so both are refused here rather
// than discovered the hard way.
//
// Override with env vars when your MySQL isn't on the default
// socket — e.g. the local Docker container from the README:
//
//   TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=3307 \
//   TEST_DB_USER=zoo_test TEST_DB_PASSWORD=zootestdev npm test
//
// That account needs more than it might look like:
//
//   CREATE USER 'zoo_test'@'%' IDENTIFIED WITH mysql_native_password
//     BY 'zootestdev';
//   GRANT ALL PRIVILEGES ON *.* TO 'zoo_test'@'%' WITH GRANT OPTION;
//   SET PERSIST log_bin_trust_function_creators = 1;
//
//  - mysql_native_password because mysql2 cannot complete MySQL 8's
//    default caching_sha2_password handshake over a plain TCP socket;
//    it fails with ER_NET_READ_INTERRUPTED / "packets out of order".
//  - Global privileges plus log_bin_trust_function_creators because
//    binary logging is on by default, and CREATE TRIGGER (migration
//    0010 adds four) is refused without SUPER.
// ============================================================

let scope = 'default';

// Called once at the top of each test file, before any hook runs.
export function useDatabase(name) {
    if (!/^[a-z][a-z0-9_]*$/.test(name)) {
        throw new Error(`Invalid test database scope: ${name}`);
    }
    scope = name;
}

export function testDbConfig() {
    const prefix = process.env.TEST_DB_PREFIX || 'coog_zoo';
    const cfg = {
        host:     process.env.TEST_DB_HOST     || '127.0.0.1',
        port:     Number(process.env.TEST_DB_PORT || 3306),
        user:     process.env.TEST_DB_USER     || 'root',
        password: process.env.TEST_DB_PASSWORD ?? '',
        database: `${prefix}_${scope}_test`,
    };
    assertDisposableTarget(cfg);
    return cfg;
}

// Two hard stops. Neither is configurable on purpose: the suite
// drops its database on the way out, so "are you sure?" is not a
// question worth asking at runtime.
export function assertDisposableTarget(cfg) {
    if (/azure|rds\.amazonaws|planetscale/i.test(cfg.host)) {
        throw new Error(
            `Refusing to run tests against a managed/production host: ${cfg.host}`
        );
    }
    if (!/_test$/.test(cfg.database)) {
        throw new Error(
            `Refusing to run tests against "${cfg.database}" — ` +
            'the test database name must end in "_test".'
        );
    }
}

// Point server/db.js (and anything else reading DB_*) at the test
// database. Must run BEFORE server/app.js is imported, because
// server/db.js builds its pool at module-evaluation time.
//
// dotenv does not overwrite variables that are already set, so these
// win over any stray .env a developer has lying around — including
// the server/.env that points at production.
export function applyServerEnv() {
    const cfg = testDbConfig();
    process.env.DB_HOST     = cfg.host;
    process.env.DB_PORT     = String(cfg.port);
    process.env.DB_USER     = cfg.user;
    process.env.DB_PASSWORD = cfg.password;
    process.env.DB_NAME     = cfg.database;
    process.env.DB_SSL      = 'false';
    process.env.JWT_SECRET  = process.env.JWT_SECRET || 'test_secret';
    return cfg;
}

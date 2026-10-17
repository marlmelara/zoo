// ============================================================
// Where the test suite is allowed to point, and nowhere else.
//
// Requires Node >= 22.13 — `npm test` passes --test-global-setup,
// which builds the database once for the whole run.
//
// Every test runs against a throwaway database that this harness
// creates and drops. It must never be the developer's `coog_zoo`
// and must never be the Azure production server, so both are
// refused here rather than discovered the hard way.
//
// Override with env vars when your MySQL isn't on the default
// socket — e.g. the local Docker container in the README:
//
//   TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=3307 \
//   TEST_DB_USER=zoo_test TEST_DB_PASSWORD=zootestdev npm test
//
// The user needs CREATE/DROP on the test database. MySQL 8 defaults
// new accounts to caching_sha2_password, which mysql2 cannot complete
// over a plain TCP socket (it dies with ER_NET_READ_INTERRUPTED /
// "packets out of order"), so create the account explicitly:
//
//   CREATE USER 'zoo_test'@'%' IDENTIFIED WITH mysql_native_password
//     BY 'zootestdev';
//   GRANT ALL PRIVILEGES ON `coog_zoo_test`.* TO 'zoo_test'@'%';
// ============================================================

export function testDbConfig() {
    const cfg = {
        host:     process.env.TEST_DB_HOST     || '127.0.0.1',
        port:     Number(process.env.TEST_DB_PORT || 3306),
        user:     process.env.TEST_DB_USER     || 'root',
        password: process.env.TEST_DB_PASSWORD ?? '',
        database: process.env.TEST_DB_NAME     || 'coog_zoo_test',
    };
    assertDisposableTarget(cfg);
    return cfg;
}

// Two hard stops. Neither is configurable on purpose: the suite
// truncates tables and drops its database, so "are you sure?" is
// not a question worth asking at runtime.
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

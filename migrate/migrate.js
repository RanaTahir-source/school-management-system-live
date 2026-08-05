/**
 * One-time data migration: Neon Postgres (old) -> Railway Postgres (new)
 *
 * WHAT THIS DOES
 * - Connects to SOURCE_DATABASE_URL (your old Neon database) and
 *   DEST_DATABASE_URL (the new Railway database).
 * - Copies every row from every table in the `public` schema, in a safe
 *   order (dependency-first where possible, and with foreign-key/trigger
 *   checks disabled during the copy so ordering issues can't break it).
 * - Does NOT touch the source (Neon) database at all - read only.
 * - Safe to re-run: it TRUNCATEs the destination tables first (only the
 *   destination, never the source) so you can run it more than once while
 *   testing without ending up with duplicate rows.
 *
 * HOW TO RUN (this file is already in your project root - just do this):
 *
 *   cd "F:\My Claude Projects\School Software\school-management-system"
 *   mkdir migrate
 *   cd migrate
 *   npm init -y
 *   npm install pg
 *   copy ..\migrate-neon-to-railway.js migrate.js
 *
 *   Windows cmd.exe:
 *     set SOURCE_DATABASE_URL=postgresql://neondb_owner:npg_Gqbuyo7k0sDM@ep-plain-flower-azwc37xh.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
 *     set DEST_DATABASE_URL=postgresql://postgres:Sms2026RailwayDbSecurePwd9x@altaria.proxy.rlwy.net:20882/railway
 *     node migrate.js
 *
 * The destination tables must already exist (you already ran
 * `npx prisma db push` against the Railway database, so this is ready).
 */

const { Client } = require('pg');

const SOURCE_URL = process.env.SOURCE_DATABASE_URL;
const DEST_URL = process.env.DEST_DATABASE_URL;

if (!SOURCE_URL || !DEST_URL) {
  console.error('ERROR: Set SOURCE_DATABASE_URL and DEST_DATABASE_URL environment variables first.');
  process.exit(1);
}

// Tables copied in this order when possible (parents before children).
// Any table not listed here is copied afterwards, in whatever order
// Postgres returns it in - safe because FK checks are disabled during copy.
const PREFERRED_ORDER = [
  'School', 'SchoolSetting', 'Branch', 'Role', 'Permission', 'RolePermission',
  'User', 'UserRole', 'Session',
  'AcademicYear', 'Class', 'Section',
  'Student', 'Parent', 'StudentParent', 'Teacher', 'Coordinator', 'StaffProfile',
  'FeeStructure', 'FeeHead', 'FeeInvoice', 'FeeInvoiceItem', 'FeePayment',
  'Attendance', 'AttendanceRecord',
  'ExamType', 'Exam', 'ExamResult', 'Result',
  'Certificate', 'Document',
  'Message', 'Notification', 'AuditLog',
];

async function getAllTables(client) {
  const res = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('_prisma_migrations')
    ORDER BY table_name;
  `);
  return res.rows.map((r) => r.table_name);
}

function orderTables(allTables) {
  const known = PREFERRED_ORDER.filter((t) => allTables.includes(t));
  const rest = allTables.filter((t) => !PREFERRED_ORDER.includes(t));
  return [...known, ...rest];
}

async function copyTable(source, dest, table) {
  const { rows } = await source.query(`SELECT * FROM "${table}";`);
  if (rows.length === 0) {
    console.log(`  ${table}: 0 rows (skipped)`);
    return 0;
  }
  const columns = Object.keys(rows[0]);
  const colList = columns.map((c) => `"${c}"`).join(', ');

  await dest.query(`TRUNCATE TABLE "${table}" CASCADE;`);

  let inserted = 0;
  for (const row of rows) {
    const values = columns.map((c) => row[c]);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    await dest.query(
      `INSERT INTO "${table}" (${colList}) VALUES (${placeholders});`,
      values
    );
    inserted += 1;
  }
  console.log(`  ${table}: ${inserted} rows copied`);
  return inserted;
}

async function main() {
  const source = new Client({ connectionString: SOURCE_URL, ssl: { rejectUnauthorized: false } });
  const dest = new Client({ connectionString: DEST_URL });

  await source.connect();
  await dest.connect();
  console.log('Connected to both databases.');

  const allTables = await getAllTables(source);
  const ordered = orderTables(allTables);
  console.log(`Found ${allTables.length} tables. Copying in this order:`);
  console.log('  ' + ordered.join(', '));

  await dest.query(`SET session_replication_role = 'replica';`);
  console.log('\nCopying data...');

  let totalRows = 0;
  for (const table of ordered) {
    try {
      totalRows += await copyTable(source, dest, table);
    } catch (err) {
      console.error(`  ${table}: FAILED - ${err.message}`);
    }
  }

  await dest.query(`SET session_replication_role = 'origin';`);

  await source.end();
  await dest.end();

  console.log(`\nDone. ${totalRows} total rows copied across ${ordered.length} tables.`);
  console.log('Please spot-check a few tables (e.g. School, Student, User) in the new database before switching the app over.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

/**
 * پیکربندی Drizzle Kit — دیتابیس محلی SQLite
 *
 * توجه: این فایل عمداً از پکیج drizzle-kit ایمپورت نمی‌کند تا بیلد برنامه
 * هرگز به نصب بودن آن وابسته نباشد. drizzle-kit با npx خودش اجرا می‌شود.
 */
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DASTIAR_DB_PATH ?? "./data/app_db.sqlite"
  }
};

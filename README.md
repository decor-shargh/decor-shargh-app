# دکوراسیون شرق — Admin V8

نسخه V8 شامل:
- لوگوی رسمی جدید دکوراسیون شرق در Login، Splash، Header و آیکون PWA
- Login مشابه Afrachoob Control Center
- Email/Password Firebase Authentication
- نمایش/مخفی‌سازی رمز
- Remember Me مشابه افراچوب: برای کاربران غیرادمین رمز به‌صورت رمزگذاری‌شده روی همان دستگاه نگهداری می‌شود؛ برای Admin ذخیره نمی‌شود
- ساخت حساب جدید با Firebase Auth و پروفایل `users/{uid}` در حالت `pending`
- صفحه انتظار تأیید مدیر برای حساب‌های جدید
- Session پایدار و بدون flash صفحه Login هنگام Refresh
- قراردادها و کتابخانه فعالیت‌ها روی Firestore
- PWA و نصب اپ
- Backup JSON از Firestore و Restore امن با بکاپ اضطراری قبل از بازیابی

## فایل مهم Rules
برای کارکرد «ساخت حساب جدید» باید محتوای `firestore.rules` در Firebase > Firestore > Rules قرار داده و Publish شود.

## نکته Backup
Backup شامل Firestore است و رمز عبور Firebase Authentication را ذخیره نمی‌کند.

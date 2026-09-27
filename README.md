# دکوراسیون شرق — Admin V5

نسخه V5 پنل Admin.

## تغییرات این نسخه
- قراردادها از LocalStorage به Cloud Firestore منتقل شدند و Firestore مرجع اصلی است.
- اگر قراردادهای نسخه قدیمی فقط در LocalStorage باشند و Firestore خالی باشد، یک بار به‌صورت خودکار مهاجرت می‌شوند.
- ایجاد، ویرایش، تغییر وضعیت، درصد پیشرفت و فعالیت‌های قرارداد مستقیماً در Firestore ذخیره می‌شوند.
- هنگام ایجاد/ویرایش قرارداد، فعالیت‌ها را همان‌جا از کتابخانه Firestore جستجو و اضافه می‌کنید.
- فعالیت‌های انتخاب‌شده به‌صورت snapshot داخل قرارداد ذخیره می‌شوند تا تغییرات بعدی کتابخانه، قراردادهای قبلی را خراب نکند.
- Login Firebase، Session محلی، کنترل role=admin و PWA نسخه قبل حفظ شده‌اند.

## فایل‌های لازم برای GitHub Pages
- index.html
- styles.css
- app.js
- manifest.webmanifest
- service-worker.js
- icon-192.png
- icon-512.png
- apple-touch-icon.png

تمام این فایل‌ها را در root ریپوی GitHub Pages قرار دهید.

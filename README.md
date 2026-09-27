# دکوراسیون شرق — Admin V3

این نسخه پنل Admin دکوراسیون شرق است.

## وضعیت فعلی
- Frontend روی GitHub Pages
- ورود واقعی با Firebase Authentication (Email/Password)
- کنترل دسترسی Admin از `users/{uid}` با `role=admin` و `active=true`
- کتابخانه فعالیت‌ها روی Cloud Firestore و به‌صورت realtime
- قراردادها هنوز موقتاً در LocalStorage هستند و در مرحله بعد به Firestore منتقل می‌شوند.

## کتابخانه فعالیت‌ها در Firestore
اپ در اولین ورود Admin، اگر کتابخانه هنوز Seed نشده باشد، کتابخانه پایه تاییدشده را خودکار ایجاد می‌کند.

Collections:
- `activityCategories`
- `activityLibrary`
- `appMeta` (marker مربوط به seed)

مدیریت کتابخانه از داخل خود اپ انجام می‌شود:
- افزودن/ویرایش/حذف دسته
- افزودن/ویرایش/حذف فعالیت
- جابه‌جایی فعالیت بین دسته‌ها از فرم ویرایش
- ویرایش امتیاز حجم کار، هزینه و مدت
- محاسبه خودکار ضریب پایه با فرمول 40% حجم + 35% هزینه + 25% مدت

حذف یا ویرایش یک فعالیت در کتابخانه، فعالیت Snapshot شده در قراردادهای قبلی را تغییر نمی‌دهد.

## انتشار روی GitHub Pages
برای ارتقا از V2 به V3 کافی است فایل `app.js` را در ریشه Repository جایگزین کنید. فایل‌های `index.html` و `styles.css` با این تغییر نیاز به جایگزینی ندارند.

## V4 - PWA + Auth boot fix
- Added installable PWA manifest and service worker.
- Added install CTA for supported browsers and iOS Add to Home Screen guidance.
- Added app icons (192, 512, Apple touch icon).
- Removed login flash on refresh: a neutral boot splash remains visible until Firebase Auth state and admin access are resolved.
- Firebase session remains LOCAL; signed-in users go straight back into the app after refresh.

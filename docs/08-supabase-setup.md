# دليل إعداد الخادم (Supabase) — خطوة بخطوة

## المتطلبات

- حساب مجاني على supabase.com.
- لا حاجة لأي خادم تديره بنفسك.

## الخطوة 1: إنشاء المشروع

1. سجل الدخول إلى Supabase واضغط New Project.
2. اختر اسما مثل `exam-platform` وكلمة مرور قوية لقاعدة البيانات واحتفظ بها.
3. انتظر اكتمال الإنشاء (دقيقتان تقريبا).

## الخطوة 2: تطبيق مخطط قاعدة البيانات

1. من القائمة افتح SQL Editor.
2. الصق كامل محتوى الملف `supabase/migrations/0001_schema.sql` ونفذه (Run).
3. الصق كامل محتوى الملف `supabase/migrations/0002_rls.sql` ونفذه.
4. الصق كامل محتوى الملف `supabase/migrations/0003_signup.sql` ونفذه.
5. تحقق من نجاح التنفيذ بدون أخطاء. أي خطأ يظهر لك انسخه وأرسله لي لأصلحه.

## الخطوة 3: إنشاء حساب المشرف

1. افتح Authentication ثم Users واضغط Add User ثم Create new user.
2. أدخل بريدك وكلمة مرور قوية (16 حرفا على الأقل، متنوعة).
3. انسخ معرف المستخدم (UID) من القائمة.
4. عدل الملف `supabase/seed.sql` وضع الـ UID والبريد ثم نفذه في SQL Editor.
5. سجل الدخول بذلك الحساب ثم فعّل المصادقة الثنائية من إعدادات حسابك
   (Authentication ثم MFA) — إلزامي لحساب المشرف.

## الخطوة 4: نشر الدوال الخادمية

من جهازك (تحتاج Node + Supabase CLI لمرة واحدة):

```
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy start-attempt
supabase functions deploy save-answer
supabase functions deploy submit-attempt
supabase functions deploy grade-item
supabase functions deploy complete-grading
supabase functions deploy publish-result
supabase functions deploy get-review
```

مفتاح الخدمة (service_role) يبقى داخل بيئة الدوال فقط ولا يظهر في الواجهة أبدا.

## الخطوة 5: مفاتيح الواجهة

1. افتح Project Settings ثم API.
2. انسخ Project URL ومفتاح anon العلني فقط.
3. لا تنسخ مفتاح service_role ولا تشاركه مع أي شخص ولا تضعه في أي ملف واجهة.
4. أرسل لي الـ URL ومفتاح anon لأعيد بناء الواجهة عليهما.

## الخطوة 6: حماية إضافية

- فعّل حد معدل المصادقة الافتراضي وتحقق منه في Authentication ثم Rate Limits.
- فعّل النسخ الاحتياطي اليومي (متاح في الخطط المدفوعة؛ في المجانية اعتمد
  التصدير اليدوي الدوري من Database ثم Backups).
- أضف طلابك من لوحة الإدارة بعد ربط الواجهة (الخطوة القادمة)، ولا تنشئ لهم
  حسابات بكلمات مرور ضعيفة — أعد التعيين عند أول دخول.

## ما بعد ذلك

بعد تزويدي بالـ URL ومفتاح anon أعيد بناء مجلد الواجهة ليعمل ضد هذا الخادم
الحقيقي (دخول، امتحانات، تقديم، تصحيح، إشعارات)، ثم ننفذ مصفوفة الاختبار
الإلزامية على بيئة تجريبية قبل الاستخدام الفعلي.

# هيكل المجلدات والنشر (Folder Structure & Deployment)

## 1. هيكل المستودع (Monorepo)

```
/
  frontend/                 الواجهة (SPA عربية RTL، تجهيز i18n للإنجليزية لاحقا)
    src/
      pages/                student/..., admin/..., exam/..., auth/...
      components/           cards, tables, charts, modals, toasts, skeletons, badges
      api/                  عميل API + إدارة الجلسة + إعادة المحاولة
      i18n/                 ar/ (en/ لاحقا)
  backend/                  (الخيار الثاني) أو supabase/ (الخيار الأول)
    src/
      routes/               auth, students, bank, exams, attempts, grading, results, notifications, reports, audit
      middleware/           auth, rbac, rateLimit, csrf, validate, idempotency
      services/             grading, exam-state, scheduler, notifications
      jobs/                 reminders, auto-submit, expiry, backups
  supabase/                 (الخيار الأول)
    migrations/             نسخ SQL مُرقمة لكل تغيير مخطط
    policies/               سياسات RLS لكل جدول
    functions/              start-attempt, save-answer, submit, grade, publish-result
  docs/                     وثائق التصميم هذه
  tests/                    مصفوفة الاختبارات الإلزامية (قسم 36)
  exam-system/              النموذج الثابت الحالي (عرض فقط، يُستبدل بالواجهة الحقيقية)
```

## 2. الأدوار المستقبلية (جاهزية من اليوم)

جدول `roles`: `super_admin, admin, teacher, grader, student`.
كل مسار يفحص قدرة (Permission) لا دورا حرفيا، مثلا `exam.create` تُمنح
لمدرس دون `system.manage`. إضافة مدرس لاحقا = صف مستخدم + منح قدرات،
بدون تغيير معماري.

## 3. البيئات والأسرار

- لا أسرار في الواجهة أبدا: فقط مفتاح النشر العلني + رابط API.
- مفاتيح الخدمة وكلمات مرور قاعدة البيانات في متغيرات بيئة الخادم فقط.
- فصل بيئتين: staging (للاختبار) وproduction. لا اختبار على الإنتاج.

## 4. النشر

- الخيار الأول: Supabase (قاعدة + مصادقة + تخزين) + الواجهة على
  Netlify/Vercel/GitHub Pages. النسخ الاحتياطي والتوسع مهمة المزود.
- الخيار الثاني: حاويات (Docker) للخادم + PostgreSQL مُدارة + CI يشغل
  الاختبارات الأمنية قبل كل نشر. لا نشر أخضر-أزرق معقد في هذه المرحلة —
  نشر متدرج بسيط مع قدرة رجوع (Rollback) للنسخة السابقة.

## 5. النسخ الاحتياطي والاستقرار

- نسخ يومي تلقائي + اختبار استعادة دوري (نسخة لا تُختبر = لا نسخة).
- حذف ناعم افتراضي + مهلة استعادة قبل الحذف الفيزيائي.
- الطوابير: الإشعارات والتذكيرات والمهام الثقيلة عبر Jobs لا داخل طلب المستخدم.
- المراقبة: سجلات مركزية + تنبيه (محاولات دخول فاشلة، أخطاء متكررة،
  امتلاء تخزين) + صفحة صحة (Health check).

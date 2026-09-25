# الاختبارات الآلية (تُشغل محليا قبل أي نشر)

## اختبارات سياسات الوصول (RLS)

تتحقق من أهم قواعد الحماية فعليا ضد قاعدة حقيقية، لا نظريا:

- الطالب لا يرى خيارات الأسئلة (الإجابات النموذجية) ولا روابط الامتحانات.
- الطالب يرى نتيجته المنشورة فقط، ولا يرى نتائج الآخرين ولا غير المنشورة.
- المصحح لا ينشئ امتحانات، والمعلم لا يدير المستخدمين ولا يعدل النتائج مباشرة.
- سجل التدقيق لا يقبل إدخالات مزورة من الطلاب.
- الزائر يرى دليل الامتحانات النشطة فقط دون بنك الأسئلة.

## التشغيل

```
# قاعدة scratch جديدة
createdb examtest
psql -d examtest -c "create schema auth; create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb); create or replace function auth.uid() returns uuid language sql as \$\$ select null::uuid \$\$;"

# الترحيلات ثم الاختبارات (يتوقف عند أول فشل)
for f in 0001_schema 0002_rls 0003_signup 0004_jobs_logout 0005_groups_storage_ratelimit 0006_rbac_split; do
  psql -d examtest -v ON_ERROR_STOP=1 -q -f supabase/migrations/$f.sql || exit 1
done
psql -d examtest -v ON_ERROR_STOP=1 -f tests/rls.test.sql
# المتوقع في النهاية: ALL RLS TESTS PASSED
```

## خارج النطاق هنا (يتطلب بيئة staging بمشروع حقيقي)

- تفويض الدوال الحافية (مثال: طالب يستدعي grade-item، مصحح يستدعي publish).
- رحلة كاملة: بدء، حفظ متزامن، تسليم مزدوج، انتهاء وقت، استئناف.
- Brute Force وCSRF وXSS على الواجهة.
- اختبار الحمل والتزامن.

هذه تُنفذ بعد ربط المشروع الحقيقي حسب مصفوفة `docs/07-reviews-and-decision.md`.

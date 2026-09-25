# هيكل الواجهات البرمجية (API Structure)

الأساس: REST + JSON. كل الطلبات عبر HTTPS. صيغة الخطأ موحدة.
المصادقة: جلسة HttpOnly أو Bearer قصير العمر + Refresh بالتناوب (يُحسم عند التنفيذ).

## 1. المصادقة والجلسات

```
POST /api/auth/login            {email, password} -> + تحدي 2FA للمشرف عند التفعيل
POST /api/auth/verify-2fa       {code}
POST /api/auth/logout
POST /api/auth/logout-all       إبطال كل الجلسات
GET  /api/auth/sessions         أجهزة/جلسات المستخدم
DELETE /api/auth/sessions/{id}
POST /api/admin/reset-password  {student_id} (مشرف فقط، يُسجل في التدقيق)
```

## 2. الطلاب (مشرف فقط)

```
GET    /api/students?q=&page=&status=
POST   /api/students
PATCH  /api/students/{id}       تعديل/تعطيل
DELETE /api/students/{id}       حذف ناعم
GET    /api/students/{id}/exams
GET    /api/students/{id}/results
```

## 3. بنك الأسئلة والامتحانات (مشرف فقط)

```
GET/POST /api/bank/questions    فلترة: subject, unit, difficulty, qtype
PATCH/DELETE /api/bank/questions/{id}
POST /api/bank/questions/{id}/duplicate
GET/POST /api/exams             status, audience
GET/PATCH/DELETE /api/exams/{id}
POST /api/exams/{id}/questions          إضافة سؤال (يدوي/من البنك)
POST /api/exams/{id}/questions/random   {count, filters} اختيار عشوائي
PATCH /api/exams/{id}/questions/reorder {ordered_ids}
POST /api/exams/{id}/publish | /archive | /schedule
```

## 4. مسار الطالب (لا تتضمن أي إجابة نموذجية أبدا)

```
GET  /api/my/exams?filter=available|upcoming|started|completed
GET  /api/my/exams/{id}                 تفاصيل + محاولات متبقية (بدون مفاتيح)
POST /api/my/exams/{id}/start           بدء/استئناف -> {attempt_id, server_deadline, questions(بدون is_correct)}
POST /api/my/attempts/{id}/answers      {question_id, answer, seq} حفظ تلقائي
POST /api/my/attempts/{id}/submit       + رأس Idempotency-Key -> إيصال + نتيجة مبدئية حسب الإعداد
GET  /api/my/results                    نتائج الطالب فقط (ملكية إجبارية)
GET  /api/my/results/{id}               تفاصيل + مراجعة (حسب allow_review)
GET  /api/my/notifications              تعليم مقروء: POST /api/my/notifications/read
```

## 5. التصحيح والنتائج (مشرف)

```
GET  /api/grading/queue?exam_id=        محاولات بحالة grading
GET  /api/grading/attempts/{id}         إجابات الطالب التحريرية + العلامات القصوى
POST /api/grading/attempts/{id}/items   {question_id, awarded_mark, feedback}
POST /api/grading/attempts/{id}/complete
PATCH /api/results/{id}                 تعديل يدوي -> يُسجل old/new + السبب
POST /api/results/{id}/publish
GET  /api/reports/exams/{id}            إحصاءات: متوسط/أعلى/أدنى/ناجحون/راسبون + ترقيم
```

## 6. قواعد ملزمة على كل مسار

1. طبقة تفويض RBAC بعد المصادقة على كل مسار (لا استثناء).
2. تحقق صارم من المدخلات (مخططات Zod/مكافئ) + حدود أحجام + تعقيم HTML.
3. لا يقبل الخادم أبدا من العميل: score, correct_answer, duration, role,
   result, manual_grade, server_deadline.
4. الترقيم إجباري لكل قائمة + حد أقصى لحجم الصفحة.
5. رأس Idempotency-Key إجباري في: start, submit, complete-grading.
6. كل عملية مغيرة ناجحة/مرفوضة حساسة تُسجل في audit_logs.

# قاعدة البيانات (Database ERD)

## 1. الكيانات والعلاقات

```
roles (1) ----< (N) users
users (1) ----< (N) students        [طالب = مستخدم بدور student + سجل أكاديمي]
users (1) ----< (N) sessions
users (1) ----< (N) audit_logs

exams (1) ----< (N) exam_questions >---- (1) question_bank
exams (1) ----< (N) exam_access        [مجموعات/رموز دخول الامتحان]
exams (1) ----< (N) attempts

question_bank (1) ----< (N) question_options
question_bank (1) ----< (N) question_versions   [نسخ الأسئلة]

attempts (1) ----< (N) answers
attempts (1) ----< (N) manual_grading
attempts (1) ---- (1) results
attempts (1) ----< (N) attempt_events            [فقدان تركيز، انقطاع، ...]

results (1) ----< (N) notifications
users (1) ----< (N) notifications
```

## 2. أهم الجداول (مختصر عملي)

### users
`id (PK), email UNIQUE, password_hash (bcrypt, لا نص صريح أبدا), role_id,
is_active, failed_attempts, locked_until, totp_secret (لـ 2FA المشرف),
created_at, updated_at, deleted_at (حذف ناعم)`

### exams
`id, title, subject, description, duration_min, starts_at, ends_at,
max_attempts, total_mark, pass_mark, show_result_immediately (bool),
allow_review (bool), shuffle_questions (bool), shuffle_options (bool),
allow_back_navigation (bool), access_code_hash (nullable),
audience (all|groups), status (draft|scheduled|published|active|expired|archived),
created_by, version, created_at, deleted_at`

### question_bank
`id, subject, unit, topic, difficulty (1-5), qtype
(mcq|tf|multi|written), mark, explanation, created_by, deleted_at`

### question_options
`id, question_id, text, is_correct, position`
(ملاحظة: `is_correct` لا يُكشف أبدا عبر أي واجهة طالب.)

### question_versions (لقطة النسخة)
`id, question_id, version_no, snapshot_json, created_at`
عند بدء محاولة تُنسخ لقطة الأسئلة إلى `attempts.question_snapshot`
فلا يؤثر أي تعديل لاحق على المحاولات السابقة.

### attempts
`id, exam_id, student_id, attempt_no, status
(in_progress|submitted|grading|graded|expired),
question_snapshot (JSONB), question_order (int[]), started_at (server),
server_deadline, submitted_at, idempotency_key UNIQUE, client_seq (لمنع التكرار)`
قيود:
- `UNIQUE(exam_id, student_id, attempt_no)` — منع التكرار.
- `CHECK(attempt_no <= exams.max_attempts)` عبر دالة تحقق.
- التسليم يتم داخل معاملة واحدة (Transaction).

### answers
`id, attempt_id, question_id, answer_json, seq, updated_at`
- `UNIQUE(attempt_id, question_id)` + رقم تسلسل العميل `seq`:
  يُقبل التحديث فقط إذا كان `seq` أحدث — يمنع حالات التضارب عند انقطاع الإنترنت.

### manual_grading
`id, attempt_id, question_id, grader_id, max_mark, awarded_mark,
feedback, status (pending|done), graded_at`
أي تعديل لاحق على `awarded_mark` ينسخ السجل القديم إلى `grade_history`.

### results
`id, attempt_id UNIQUE, auto_score, manual_score, final_score,
correct_count, wrong_count, unanswered_count, percentage, passed (bool),
published (bool), published_at`
- `final_score` تُحسب في الخادم فقط (`auto + manual`)، ولا تُقبل من العميل أبدا.

### exam_states (آلة الحالة)
`draft -> scheduled -> published -> active -> expired -> archived`
الانتقالات محكومة بدوال في الخادم (التواريخ + إجراء المشرف)، والطالب لا يرى
إلا الامتحان في `active` وضمن نافذته الزمنية ومجموعته.

### audit_logs (إلحاق فقط، بدون تعديل/حذف عبر API)
`id, actor_id, action, entity, entity_id, old_value, new_value,
ip, user_agent, session_id, created_at`
يُسجل: دخول/خروج، بدء/تسليم، تغيير إجابة (بإيجاز)، انتهاء وقت، وصول مرفوض،
تعديل امتحان/سؤال/نتيجة، إعادة تعيين كلمة مرور.

### notifications
`id, user_id, type, title, body, link, is_read, created_at`
فهرس `(user_id, is_read, created_at)` لسرعة صندوق الطالب.

## 3. الفهارس والأداء

- `attempts(exam_id, status)` — قائمة "يحتاج تصحيح".
- `results(exam_id, final_score DESC)` — ترتيب وفلترة النتائج.
- `answers(attempt_id)` — جلب إجابات المحاولة.
- ترقيم (Pagination) إجباري في كل قوائم الإدارة والنتائج وسجل التدقيق.
- تخزين مؤقت (Cache) للقوائم العامة فقط (الامتحانات المنشورة)، أما الدرجات
  والنتائج فلا تُخزن مؤقتا أبدا.

## 4. منع التكرار وسباقات التزامن (Race Conditions)

1. التسليم: `Idempotency-Key` + قيد `UNIQUE` + معاملة واحدة — إرسال مزدوج
   (نقرة مزدوجة/تحديث) ينتج نتيجة واحدة فقط.
2. بدء محاولة: قفل على مستوى `(exam_id, student_id)` داخل المعاملة قبل عد
   المحاولات — يمنع تجاوز `max_attempts` عند الطلبات المتزامنة.
3. حفظ الإجابات: شرط `seq` الأحدث يفوز — يمنع كتابة قديمة فوق أحدث بعد انقطاع.
4. التصحيح اليدوي المتزامن: قفل متفائل برقم نسخة على سجل التصحيح.

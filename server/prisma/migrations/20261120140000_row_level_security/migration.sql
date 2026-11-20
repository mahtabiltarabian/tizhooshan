-- Row-level security (plan v3, section 12: each school's data kept apart).
--
-- Signed-in requests run as the role tizhooshan_app (PrismaService.asUser:
-- SET LOCAL ROLE, and app.user_id set to the signed-in user). The rules
-- below let that role see and change only the user's own rows:
--   parent:  their children, and those children's answers, abilities,
--            notebook, memberships, and the classrooms and assignments of
--            classrooms their children are in;
--   teacher: their classrooms and assignments, the children in them
--            (nickname, picture, grade), those children's abilities and
--            notebook, and their answers from the day they joined.
-- Sign-in (users, codes, tokens) is never open to the role. The connecting
-- user (the tables' owner) is not limited: migrations, sign-in, and the
-- join-code lookup use it.
--
-- Needs a database user that may create roles (the Docker image's user is a
-- superuser). The role has no login and no password: only the connecting
-- user can switch to it.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tizhooshan_app') THEN
    CREATE ROLE tizhooshan_app NOLOGIN;
  END IF;
END
$$;

GRANT tizhooshan_app TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO tizhooshan_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON children, classrooms, memberships, assignments, attempts, skill_states, review_items TO tizhooshan_app;

-- The signed-in user, or NULL (then every rule below is false).
CREATE FUNCTION app_user() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $$;

-- Helpers that look across tables. SECURITY DEFINER: they run as the owner,
-- so a rule on one table does not trigger the rules of another (which would
-- loop). Each answers only yes or no about the signed-in user.
CREATE FUNCTION app_is_parent(child uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT EXISTS (SELECT 1 FROM children c WHERE c.id = child AND c.parent_id = app_user()) $$;

CREATE FUNCTION app_teaches(child uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT EXISTS (
    SELECT 1 FROM memberships m JOIN classrooms k ON k.id = m.classroom_id
    WHERE m.child_id = child AND k.teacher_id = app_user()) $$;

-- The teacher sees an answer only if the child was in one of their classrooms when it was given.
CREATE FUNCTION app_teaches_at(child uuid, at timestamp) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT EXISTS (
    SELECT 1 FROM memberships m JOIN classrooms k ON k.id = m.classroom_id
    WHERE m.child_id = child AND k.teacher_id = app_user() AND m.joined_at <= at) $$;

CREATE FUNCTION app_owns_classroom(classroom uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT EXISTS (SELECT 1 FROM classrooms k WHERE k.id = classroom AND k.teacher_id = app_user()) $$;

CREATE FUNCTION app_child_in(classroom uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT EXISTS (
    SELECT 1 FROM memberships m JOIN children c ON c.id = m.child_id
    WHERE m.classroom_id = classroom AND c.parent_id = app_user()) $$;

REVOKE ALL ON FUNCTION app_is_parent(uuid), app_teaches(uuid), app_teaches_at(uuid, timestamp), app_owns_classroom(uuid), app_child_in(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_user(), app_is_parent(uuid), app_teaches(uuid), app_teaches_at(uuid, timestamp), app_owns_classroom(uuid), app_child_in(uuid) TO tizhooshan_app;

ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_items ENABLE ROW LEVEL SECURITY;

-- children
CREATE POLICY children_read ON children FOR SELECT TO tizhooshan_app USING (parent_id = app_user() OR app_teaches(id));
CREATE POLICY children_add ON children FOR INSERT TO tizhooshan_app WITH CHECK (parent_id = app_user());
CREATE POLICY children_change ON children FOR UPDATE TO tizhooshan_app USING (parent_id = app_user()) WITH CHECK (parent_id = app_user());
CREATE POLICY children_remove ON children FOR DELETE TO tizhooshan_app USING (parent_id = app_user());

-- classrooms
CREATE POLICY classrooms_read ON classrooms FOR SELECT TO tizhooshan_app USING (teacher_id = app_user() OR app_child_in(id));
CREATE POLICY classrooms_add ON classrooms FOR INSERT TO tizhooshan_app WITH CHECK (teacher_id = app_user());
CREATE POLICY classrooms_change ON classrooms FOR UPDATE TO tizhooshan_app USING (teacher_id = app_user()) WITH CHECK (teacher_id = app_user());
CREATE POLICY classrooms_remove ON classrooms FOR DELETE TO tizhooshan_app USING (teacher_id = app_user());

-- memberships: a parent puts their own child in; the parent or the teacher takes them out.
CREATE POLICY memberships_read ON memberships FOR SELECT TO tizhooshan_app USING (app_is_parent(child_id) OR app_owns_classroom(classroom_id));
CREATE POLICY memberships_add ON memberships FOR INSERT TO tizhooshan_app WITH CHECK (app_is_parent(child_id));
CREATE POLICY memberships_remove ON memberships FOR DELETE TO tizhooshan_app USING (app_is_parent(child_id) OR app_owns_classroom(classroom_id));

-- assignments
CREATE POLICY assignments_read ON assignments FOR SELECT TO tizhooshan_app USING (app_owns_classroom(classroom_id) OR app_child_in(classroom_id));
CREATE POLICY assignments_add ON assignments FOR INSERT TO tizhooshan_app WITH CHECK (app_owns_classroom(classroom_id));
CREATE POLICY assignments_remove ON assignments FOR DELETE TO tizhooshan_app USING (app_owns_classroom(classroom_id));

-- attempts: added by the parent's device, never changed.
CREATE POLICY attempts_read ON attempts FOR SELECT TO tizhooshan_app USING (app_is_parent(child_id) OR app_teaches_at(child_id, created_at));
CREATE POLICY attempts_add ON attempts FOR INSERT TO tizhooshan_app WITH CHECK (app_is_parent(child_id));

-- skill_states and review_items: rebuilt by the parent's sync, read by the teacher.
CREATE POLICY skill_states_read ON skill_states FOR SELECT TO tizhooshan_app USING (app_is_parent(child_id) OR app_teaches(child_id));
CREATE POLICY skill_states_add ON skill_states FOR INSERT TO tizhooshan_app WITH CHECK (app_is_parent(child_id));
CREATE POLICY skill_states_remove ON skill_states FOR DELETE TO tizhooshan_app USING (app_is_parent(child_id));
CREATE POLICY review_items_read ON review_items FOR SELECT TO tizhooshan_app USING (app_is_parent(child_id) OR app_teaches(child_id));
CREATE POLICY review_items_add ON review_items FOR INSERT TO tizhooshan_app WITH CHECK (app_is_parent(child_id));
CREATE POLICY review_items_remove ON review_items FOR DELETE TO tizhooshan_app USING (app_is_parent(child_id));

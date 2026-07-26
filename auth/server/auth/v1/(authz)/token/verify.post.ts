import { defineHandler, type H3Event } from "nitro";

/* 
{
  "iss": "auth.university-enterprise",
  "aud": "university-enterprise",
  "iat": 1721970000,
  "exp": 1721973600,

  "shadow_id": "opaque-uuid",
  "role": "faculty_admin",
  "scope": ["faculty.identity.read"],
  "tenant": "university_enterprise",

  "session_id": "uuid",
  "device_id": "opaque-device-id",
  "mfa": true
}
*/

export default defineHandler((event: H3Event) => {

});
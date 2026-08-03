import { AccessControl } from "accesscontrol";
import { Role } from "./interface.ts";

const ac = new AccessControl();

const piiFieldTier = {
    "tier-S": [
        "encryptedPII", "encryptedDataKey", 
        "keyVersion", "HMACSearchKeys", 
        "shadowID"
    ], // Highly sensitive and need to be handled carefully
    "tier-A": [
        "passport", "visa", 
        "TFN", "OSHC", 
        "identityDocuments", "emergencyContacts", 
        "citizenshipStatus"
    ], // Sensitive and should be restricted to specific roles.
    "tier-B": ["DOB", "personalEmail", "phone", "address"], // Sensitive and should be restricted to specific roles.
    "tier-C": ["name", "uniId", "faculty", "uniEmail", "program"], // Less sensitive and can be shared with more users.
}

ac.grant(Role.Student)
    .readOwn("pii", [ ...piiFieldTier["tier-C"], ...piiFieldTier["tier-B"]])
    .createOwn("pii", [ ...piiFieldTier["tier-C"], ...piiFieldTier["tier-B"]]);

ac.grant(Role.Instructor)
    .extend(Role.Student)
    .readOwn("pii", [ ...piiFieldTier["tier-A"], ...piiFieldTier["tier-B"] ]);

ac.grant(Role.FacultyAdmin)
    .extend(Role.Instructor)
    .readAny("pii", [
        ...piiFieldTier["tier-C"], 
        ...piiFieldTier["tier-B"]
    ]);


ac.grant(Role.CentralAdmin)
    .extend(Role.FacultyAdmin)
    .readAny("pii", piiFieldTier["tier-A"])
    .createAny("pii", [
        ...piiFieldTier["tier-A"], 
        ...piiFieldTier["tier-B"], 
        ...piiFieldTier["tier-C"]
    ])
    .updateAny("pii", [
        ...piiFieldTier["tier-A"], 
        ...piiFieldTier["tier-B"], 
        ...piiFieldTier["tier-C"]
    ]); 

// SystemAdmin has the highest level of access and can perform any action on any resource.
// By the way, some organisations inside the university can have system administrators, such as the IT department, which can manage the entire system and have access to all data and resources.
ac.grant(Role.SystemAdmin)
    .extend(Role.CentralAdmin)
    .readAny("pii", piiFieldTier["tier-S"])
    .deleteAny("pii", [
        ...piiFieldTier["tier-A"], 
        ...piiFieldTier["tier-B"], 
        ...piiFieldTier["tier-C"]
    ]);

export default ac;
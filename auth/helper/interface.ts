import type { JWTPayload } from 'jose';
import type { Session, SessionData } from 'nitro/h3';
import { type UUIDTypes } from 'uuid';

export enum University {
    unimelb = "University of Melbourne",
    usyd = "University of Sydney",
}

export enum Role {
    Student = "student",
    Instructor = "instructor",
    FacultyAdmin = "faculty_admin",
    CentralAdmin = "central_admin",
    SystemAdmin = "system_admin"
}

export enum ServiceName {
    Identity = "the identity",
    Auth = "auth",
    Coordinator = "the coordinator",
    Calculator = "the calculator",
}

// campus tree structure;
export const UniCampus: Record<University, string[]> = {
    "University of Melbourne": ["Parkville", "Southbank", "Burnley"],
    "University of Sydney": ["Camperdown", "Darlington", "Surry Hill"]
}

export class ShadowID {
    static ShadowIDRegex: RegExp = /^[DEMPRSWX]\d{7}[KLJNPQRSTUWXYZ]$/i ;
    static weights: number[] = [ 2, 7, 6, 5, 4, 3, 2 ];
    static checksum: string = "KLJNPQRSTUWXYZ";

    static isValidShadowID(text: string): boolean {
        return this.ShadowIDRegex.test(text);
    }

    static isValidChecksum(test: string): boolean {
        const upperTest = test.toUpperCase();

        if (!this.isValidShadowID(upperTest)) {
            throw new Error("Invalid ShadowID format");
        }

        let summa = 0;

        switch (upperTest[0]) {
            case "P":
            case "X":
                summa += 5;
                break;
                
            case "R": 
                summa += 4;
                break;
            
            default:
                summa += 0;
        }

        summa += this.weights.reduce((acc, weight, i) => {
            return acc + Number(upperTest[i + 1]) * weight;
        }, 0);

        const remainder = summa % 13;
        
        return upperTest[8] === this.checksum[remainder];
    }

    static parseShadowID(value: string): ShadowID {
        if (!this.isValidShadowID(value)) {
            throw new Error("Invalid ShadowID format");
        } else if (!this.isValidChecksum(value)) {
            throw new Error("Invalid checksum value")
        }
        return (value as unknown) as ShadowID; // Safely cast to branded type after check
    }
}


export interface PII {
    firstName: string;
    lastName: string;
    personal_email: string;
    uni_email: string;
    uni_id: string;
    address: string;
    dob: Date;
    phoneNumber: string;
}

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

export interface JWEPayload extends JWTPayload {
    shadow_id: ShadowID;
    role: Role;
    token_scope: string[];
    tenant: University;
    session_id: UUIDTypes;
    device_metadata: string | null;
    issued_at: EpochTimeStamp;
    expiry: EpochTimeStamp;
}

// SESSION(session_id, shadow_id, device, hashed_ip, iat, exp, tenant, hashed_token, token_scope)

export interface SessionObject extends SessionData {
  sessionId: UUIDTypes;
  hashedToken: string;
  shadowId: ShadowID;
  hashedIP?: string;
  userAgent?: string;
  tenant: University;
  iat: EpochTimeStamp;
  exp: EpochTimeStamp;
}

/*
{
  "event_id": "uuid",
  "shadow_id": "X8054061K",
  "event_type": "identity.pii.encrypted",
  "timestamp": "2026-07-26T14:32:00Z",
  "payload": { ... },
  "meta": {
    "tenant": University Name,
    "source_service": "identity",
    "version": "1.0"
  }
}
*/
export interface EventAMQP {
    eventID: UUIDTypes;
    shadowID: ShadowID;
    eventType: string;
    timestamp: string;
    payload: Record<string, unknown>;
    meta: {
        tenant: University;
        sourceService: ServiceName;
        version: string;
    }
}
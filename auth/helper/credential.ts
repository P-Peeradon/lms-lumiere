import bcrypt from 'bcryptjs';
import { createHmac, timingSafeEqual } from 'crypto';

function hashPassword(password: string): string {
    // Implement your password hashing logic here
    return bcrypt.hashSync(password, 12); 
}

function verifyPassword(password: string, hashedPassword: string): boolean {
    // Implement your password verification logic here
    return bcrypt.compareSync(password, hashedPassword); 
}

function hashCredential(text: string, secret: string): string {
    return createHmac("sha256", "").update(text).digest("base64");
}

function compareHash(cipher1: string, cipher2: string): boolean {
    const buffer1 = Buffer.from(cipher1, 'base64')
    const buffer2 = Buffer.from(cipher2, 'base64')

    if (buffer1.length !== buffer2.length) {
        return false;
    }

    return timingSafeEqual(buffer1, buffer2);
}

const passwordHelper = {
    hashPassword,
    verifyPassword,
    hashCredential,
    compareHash
};

export default passwordHelper;
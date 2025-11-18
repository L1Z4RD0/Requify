const crypto = require('crypto');

let bcryptLib = null;
try {
    // eslint-disable-next-line global-require
    bcryptLib = require('bcrypt');
} catch (error) {
    console.warn('[security] El paquete "bcrypt" no está disponible en este entorno. Se usará PBKDF2 como respaldo.');
}

const PBKDF2_PREFIX = 'pbkdf2$';
const PBKDF2_ITERATIONS = 150000;
const PBKDF2_KEY_LENGTH = 64;
const PBKDF2_DIGEST = 'sha512';

const isBcryptHash = (value = '') => typeof value === 'string' && value.startsWith('$2');
const isPbkdf2Hash = (value = '') => typeof value === 'string' && value.startsWith(PBKDF2_PREFIX);
const isPlainText = (value = '') => !!value && !isBcryptHash(value) && !isPbkdf2Hash(value);

const pbkdf2Async = (password, salt, iterations = PBKDF2_ITERATIONS) => new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST, (err, derivedKey) => {
        if (err) {
            reject(err);
            return;
        }
        resolve(derivedKey);
    });
});

async function hashPassword(password) {
    if (!password) {
        throw new Error('La contraseña es obligatoria');
    }
    if (bcryptLib) {
        return bcryptLib.hash(password, 10);
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = await pbkdf2Async(password, salt);
    return `${PBKDF2_PREFIX}${PBKDF2_ITERATIONS}$${salt}$${derived.toString('hex')}`;
}

async function comparePassword(password, hashedPassword) {
    if (!hashedPassword) {
        return false;
    }
    if (isBcryptHash(hashedPassword)) {
        if (!bcryptLib) {
            throw new Error('Se encontró una contraseña cifrada con bcrypt, pero el paquete no está disponible.');
        }
        return bcryptLib.compare(password, hashedPassword);
    }
    if (isPbkdf2Hash(hashedPassword)) {
        const [, iterationString, salt, storedKey] = hashedPassword.split('$');
        const iterations = parseInt(iterationString, 10) || PBKDF2_ITERATIONS;
        const derived = await pbkdf2Async(password, salt, iterations);
        const storedBuffer = Buffer.from(storedKey, 'hex');
        return storedBuffer.length === derived.length && crypto.timingSafeEqual(storedBuffer, derived);
    }
    return password === hashedPassword;
}

function needsRehash(hashedPassword) {
    if (!hashedPassword) {
        return true;
    }
    if (isBcryptHash(hashedPassword)) {
        return false;
    }
    return true;
}

module.exports = {
    hashPassword,
    comparePassword,
    needsRehash,
    isBcryptHash,
    isPbkdf2Hash,
    isPlainText,
};

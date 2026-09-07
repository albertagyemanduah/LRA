import { Router } from 'express';
import healthCheck from './health-check.js';
import sms from './sms.js';
import { sendOtp, verifyOtp } from './otp.js';
import dbExport from './db-export.js';
import dbImport from './db-import.js';
import integratedAiRouter from './integrated-ai.js';
import publicStats from './public-stats.js';

const router = Router();

export default () => {
    router.get('/health', healthCheck);
    router.post('/sms', sms);
    router.post('/otp/send', sendOtp);
    router.post('/otp/verify', verifyOtp);
    router.get('/db/export', dbExport);
    router.post('/db/import', dbImport);
    router.use('/integrated-ai', integratedAiRouter);
    router.get('/public-stats', publicStats);

    return router;
};


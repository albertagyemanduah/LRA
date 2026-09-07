import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';

/**
 * Public aggregate statistics for the landing page.
 *
 * Returns ONLY counts — no private officer or land details, no fees.
 * Counts follow the application's existing status/visibility rules:
 *  - Registered Parcels: parcels with status = "registered"
 *  - Land Transfers: all land_transfers records (pending/approved/rejected)
 *  - Active Officers: users that are not suspended
 *  - Area Councils: area_councils that are not soft-deleted
 */
async function count(collection, filter = '') {
    try {
        const res = await pb.collection(collection).getList(1, 1, {
            filter,
            requestKey: `public-stats-${collection}`,
        });
        return res.totalItems;
    } catch (err) {
        logger.warn(`public-stats: count failed for ${collection}`, err?.message || err);
        return null;
    }
}

export default async (req, res) => {
    try {
        const [parcels, transfers, officers, councils] = await Promise.all([
            count('parcels', 'status = "registered"'),
            count('land_transfers', ''),
            count('users', 'suspended != true'),
            count('area_councils', 'isDeleted != true'),
        ]);

        res.set('Cache-Control', 'public, max-age=30');
        res.json({
            parcels,
            transfers,
            officers,
            councils,
        });
    } catch (err) {
        logger.error('public-stats: aggregate failed', err);
        res.status(500).json({
            parcels: null,
            transfers: null,
            officers: null,
            councils: null,
        });
    }
};

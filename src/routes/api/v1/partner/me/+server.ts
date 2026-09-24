import { json } from '@sveltejs/kit';
import { authenticatePartner } from '../auth';

/** GET /api/v1/partner/me: lets a partner check their key and see which metrics they may send. */
export async function GET({ request }) {
	const { admin, orgId, app, metrics } = await authenticatePartner(request);
	const { data: org } = await admin.from('organizations').select('name').eq('id', orgId).single();
	return json({ app: { name: app.name, slug: app.slug }, account: { name: org?.name }, metrics });
}

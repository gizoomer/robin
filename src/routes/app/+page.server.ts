import { fail, redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	const { user } = await locals.safeGetSession();
	const [{ data: orgs }, { data: profile }] = await Promise.all([
		locals.supabase.from('organizations').select('id, name, slug').order('name'),
		locals.supabase.from('profiles').select('is_agency_staff, full_name').eq('id', user!.id).single()
	]);
	const isAgency = !!profile?.is_agency_staff;
	if (!isAgency && orgs?.length === 1) redirect(303, `/app/${orgs[0].slug}`);
	return { orgs: orgs ?? [], isAgency, name: profile?.full_name ?? '' };
}

export const actions = {
	createOrg: async ({ request, locals }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
		if (slug.length < 2) return fail(400, { error: 'Name is too short' });
		const { error } = await locals.supabase.from('organizations').insert({ name, slug });
		if (error) return fail(400, { error: error.code === '23505' ? 'That client already exists' : error.message });
		redirect(303, `/app/${slug}/integrations`);
	}
};

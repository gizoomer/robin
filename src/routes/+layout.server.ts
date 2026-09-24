export async function load({ locals }) {
	const { session } = await locals.safeGetSession();
	return { session };
}

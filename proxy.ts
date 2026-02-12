import {
	clerkMiddleware,
	createRouteMatcher,
} from "@clerk/nextjs/server";

// Protect app pages. API routes handle auth inside each route.
const isProtectedRoute = createRouteMatcher([
	"/dashboard(.*)",
	"/products(.*)",
	"/purchases(.*)",
	"/adjustments(.*)",
	"/transactions(.*)",
	"/tabs(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
	if (!isProtectedRoute(req)) return;

	await auth.protect();
});

export const config = {
	matcher: [
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};

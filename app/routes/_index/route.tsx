import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

// Scoped to this route (not app/root.tsx) so the embedded admin's own
// Polaris/Inter font loading is untouched - this page is the only one
// outside that system, and is styled to match the thankSnap marketing
// site (thanksnap-website/index.html) rather than Shopify admin.
export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:ital,opsz,wght@0,12..96,200..800;1,12..96,200..800&family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <div className={styles.brand}>
          <svg
            className={styles.logoMark}
            viewBox="0 0 1573 1608"
            aria-hidden="true"
          >
            <rect x="104" y="100" width="1365" height="1400" rx="200" stroke="#0F6E56" strokeWidth="200" strokeLinejoin="round" />
            <rect x="104" y="100" width="1365" height="1400" rx="200" fill="#1D9E75" />
            <rect x="208.65" y="263.33" width="910" height="145.83" rx="72.92" fill="#E1F5EE" />
            <rect opacity="0.5" x="208.65" y="702" width="455" height="145.83" rx="72.92" fill="#E1F5EE" />
            <rect opacity="0.75" x="208.65" y="482.67" width="682.5" height="145.83" rx="72.92" fill="#E1F5EE" />
            <ellipse cx="1267.09" cy="336.25" rx="71.09" ry="72.92" fill="#D9D9D9" />
            <ellipse opacity="0.5" cx="1267.09" cy="774.92" rx="71.09" ry="72.92" fill="#D9D9D9" />
            <ellipse opacity="0.75" cx="1267.09" cy="555.58" rx="71.09" ry="72.92" fill="#D9D9D9" />
            <ellipse cx="1267.66" cy="335.67" rx="28.44" ry="29.17" fill="#0F6E56" />
          </svg>
          <h1 className={styles.wordmark}>
            thank<span className={styles.accent}>Snap</span>
          </h1>
        </div>
        <p className={styles.text}>
          A post-purchase survey for your Thank you page — find out how
          customers found your store, right after they check out.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input
                className={styles.input}
                type="text"
                name="shop"
                autoComplete="off"
                placeholder="my-shop-domain.myshopify.com"
              />
              <span className={styles.hint}>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Customizable survey</strong>. Build your own questions —
            single choice, multiple choice, short text, or a rating — or
            start from a ready-made template.
          </li>
          <li>
            <strong>Seamless checkout integration</strong>. Renders as a
            native block on the Thank you page, matching your checkout&apos;s
            look and feel.
          </li>
          <li>
            <strong>Response tracking</strong>. See every answer and your
            response rate right from your dashboard.
          </li>
        </ul>
      </div>
    </div>
  );
}

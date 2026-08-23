import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

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
        <h1 className={styles.heading}>ThankSnap</h1>
        <p className={styles.text}>
          A post-purchase survey for your Thank you page — find out how
          customers found your store, right after they check out.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
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

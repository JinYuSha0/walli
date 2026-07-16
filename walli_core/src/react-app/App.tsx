import { useState } from "react";
import "./App.css";
import { authClient } from "./auth-client";

type AdminResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
  requiredRole?: string;
};

function App() {
  const session = authClient.useSession();
  const [adminResult, setAdminResult] = useState<AdminResponse | null>(null);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(false);

  const signInWithGoogle = async () => {
    const callbackURL = window.location.href;

    await authClient.signIn.social({
      provider: "google",
      callbackURL,
      errorCallbackURL: callbackURL,
    });
  };

  const signOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          setAdminResult(null);
        },
      },
    });
  };

  const checkAdminApi = async () => {
    setIsCheckingAdmin(true);
    try {
      const response = await fetch("/api/admin/status", {
        credentials: "include",
      });
      setAdminResult((await response.json()) as AdminResponse);
    } finally {
      setIsCheckingAdmin(false);
    }
  };

  return (
    <main className="shell">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">walli_core Console</p>
            <h1>后台登录</h1>
          </div>
          {session.data && (
            <button className="secondary" onClick={signOut} type="button">
              退出
            </button>
          )}
        </div>

        {session.isPending && <p className="muted">正在读取登录状态...</p>}

        {!session.isPending && !session.data && (
          <div className="login-block">
            <p>使用 Google 邮箱登录后，后端会在管理员接口校验角色。</p>
            <button onClick={signInWithGoogle} type="button">
              使用 Google 登录
            </button>
          </div>
        )}

        {session.data && (
          <div className="account-block">
            <div>
              <span className="label">当前用户</span>
              <strong>{session.data.user.name}</strong>
              <p>{session.data.user.email}</p>
            </div>
            <div>
              <span className="label">Role</span>
              <strong>{session.data.user.role ?? "user"}</strong>
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Protected API</p>
            <h2>/api/admin/status</h2>
          </div>
          <button disabled={!session.data || isCheckingAdmin} onClick={checkAdminApi} type="button">
            {isCheckingAdmin ? "校验中" : "测试管理员接口"}
          </button>
        </div>

        <pre className="result">
          {adminResult
            ? JSON.stringify(adminResult, null, 2)
            : "登录后点击测试。非 admin 会返回 403。"}
        </pre>
      </section>
    </main>
  );
}

export default App;

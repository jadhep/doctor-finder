import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  Clock3,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { isAccountApproved, normalizeAccountStatus } from "@/lib/account-access";
import { listPendingAccounts, reviewAccount } from "@/lib/account.functions";

type GatePhase = "loading" | "signed-out" | "approved" | "pending" | "rejected" | "error";
type AuthMode = "signin" | "signup";

export function AccountGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [phase, setPhase] = useState<GatePhase>("loading");
  const [isAdmin, setIsAdmin] = useState(false);
  const [statusRefreshKey, setStatusRefreshKey] = useState(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setPhase(nextUser ? "loading" : "signed-out");
      setIsAdmin(false);
    });

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      const nextUser = error ? null : data.user;
      setUser(nextUser);
      setPhase(nextUser ? "loading" : "signed-out");
    }).catch(() => {
      if (!active) return;
      setUser(null);
      setPhase("signed-out");
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setPhase("loading");

    void Promise.all([
      supabase.from("account_access").select("status").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]).then(([accessResult, rolesResult]) => {
      if (!active) return;
      if (accessResult.error || rolesResult.error || !accessResult.data) {
        setPhase("error");
        setIsAdmin(false);
        return;
      }
      const status = normalizeAccountStatus(accessResult.data.status);
      if (!status) {
        setPhase("error");
        setIsAdmin(false);
        return;
      }
      setIsAdmin(rolesResult.data.some((item) => item.role === "admin"));
      setPhase(isAccountApproved(status) ? "approved" : status);
    }).catch(() => {
      if (!active) return;
      setPhase("error");
      setIsAdmin(false);
    });

    return () => {
      active = false;
    };
  }, [user, statusRefreshKey]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setPhase("error");
      return;
    }
    setUser(null);
    setIsAdmin(false);
    setPhase("signed-out");
  };

  if (phase === "loading") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-5 animate-spin text-primary" /> Memeriksa akun...
        </div>
      </main>
    );
  }

  if (phase === "signed-out") return <AuthScreen />;

  if (phase === "pending" || phase === "rejected" || phase === "error") {
    const isPending = phase === "pending";
    const isError = phase === "error";
    return (
      <main className="min-h-screen bg-background">
        <section className="bg-hero text-primary-foreground">
          <div className="mx-auto max-w-3xl px-4 py-10">
            <p className="text-sm font-medium opacity-90">Faskes Finder</p>
            <h1 className="mt-3 text-3xl font-bold">Status akun</h1>
          </div>
        </section>
        <div className="mx-auto -mt-5 max-w-3xl px-4 pb-12">
          <section className="rounded-xl border border-border bg-card p-6 shadow-soft" aria-live="polite">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
                {isPending ? <Clock3 className="size-5" /> : isError ? <RefreshCw className="size-5" /> : <X className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold">
                  {isPending ? "Menunggu persetujuan" : isError ? "Status belum dapat diperiksa" : "Akses belum disetujui"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isPending
                    ? "Akun Anda sudah terdaftar dan sedang menunggu persetujuan administrator."
                    : isError
                      ? "Kami belum dapat memastikan status akun Anda. Coba periksa kembali."
                      : "Akun ini belum mendapat izin untuk menggunakan fitur pencarian. Hubungi administrator jika perlu bantuan."}
                </p>
                {user?.email && <p className="mt-3 break-all text-sm font-medium">{user.email}</p>}
                <div className="mt-5 flex flex-wrap gap-2">
                  {(isPending || isError) && (
                    <Button variant="outline" onClick={() => setStatusRefreshKey((value) => value + 1)}>
                      <RefreshCw /> Periksa status lagi
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => void signOut()}>
                    <LogOut /> Keluar
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Akun aktif</p>
            <p className="truncate text-sm font-medium">{user?.email}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            <LogOut /> Keluar
          </Button>
        </div>
      </header>
      {isAdmin && <AdminApprovals />}
      {children}
    </>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setNotice("Pendaftaran diterima. Periksa email dan klik tautan konfirmasi. Setelah akun aktif, akses tetap menunggu persetujuan administrator.");
        }
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message.toLowerCase() : "";
      setError(
        message.includes("invalid login credentials")
          ? "Email atau kata sandi tidak cocok."
          : message.includes("user already registered")
            ? "Email ini sudah terdaftar. Silakan masuk."
            : message.includes("password")
              ? "Kata sandi belum memenuhi ketentuan. Gunakan minimal 6 karakter."
              : "Tidak dapat memproses akun. Periksa email dan kata sandi, lalu coba lagi.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background pb-12">
      <section className="bg-hero text-primary-foreground">
        <div className="mx-auto max-w-3xl px-4 pb-20 pt-10">
          <p className="text-sm font-medium opacity-90">Faskes Finder</p>
          <h1 className="mt-4 text-3xl font-bold">Akses akun</h1>
          <p className="mt-2 max-w-xl opacity-90">Masuk atau daftarkan akun untuk melanjutkan.</p>
        </div>
      </section>
      <div className="mx-auto -mt-12 max-w-md px-4">
        <section className="rounded-xl border border-border bg-card p-5 shadow-soft sm:p-6">
          <div className="mb-5 grid grid-cols-2 gap-2" role="tablist" aria-label="Pilihan akun">
            <Button type="button" variant={mode === "signin" ? "default" : "outline"} onClick={() => { setMode("signin"); setError(""); setNotice(""); }}>
              Masuk
            </Button>
            <Button type="button" variant={mode === "signup" ? "default" : "outline"} onClick={() => { setMode("signup"); setError(""); setNotice(""); }}>
              Daftar
            </Button>
          </div>
          <h2 className="text-xl font-semibold">{mode === "signin" ? "Selamat datang kembali" : "Buat akun"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" ? "Gunakan email dan kata sandi terdaftar." : "Akun baru perlu konfirmasi email dan persetujuan administrator."}
          </p>
          <form className="mt-5 space-y-4" onSubmit={(event) => void submit(event)}>
            <div className="space-y-2">
              <Label htmlFor="account-email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="account-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="pl-9"
                  placeholder="nama@email.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-password">Kata sandi</Label>
              <Input
                id="account-password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                minLength={6}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimal 6 karakter"
              />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            {notice && <p className="rounded-md border border-border bg-secondary px-3 py-2 text-sm" role="status">{notice}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <><Loader2 className="animate-spin" /> Memproses...</> : mode === "signin" ? "Masuk" : "Daftar akun"}
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}

function AdminApprovals() {
  const listFn = useServerFn(listPendingAccounts);
  const reviewFn = useServerFn(reviewAccount);
  const queryClient = useQueryClient();
  const pendingQuery = useQuery({
    queryKey: ["pending-account-approvals"],
    queryFn: () => listFn(),
  });
  const reviewMutation = useMutation({
    mutationFn: (input: { userId: string; status: "approved" | "rejected" }) => reviewFn({ data: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pending-account-approvals"] });
    },
  });

  return (
    <section className="border-b border-border bg-muted/50">
      <div className="mx-auto max-w-5xl px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="size-5 text-primary" /> Persetujuan pengguna</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tinjau pendaftar sebelum mereka dapat mencari kontak.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void pendingQuery.refetch()} disabled={pendingQuery.isFetching} aria-label="Muat ulang pendaftar">
            <RefreshCw className={pendingQuery.isFetching ? "animate-spin" : ""} /> Muat ulang
          </Button>
        </div>

        {pendingQuery.isPending ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="size-4 animate-spin" /> Memuat pendaftar...</p>
        ) : pendingQuery.isError ? (
          <p className="mt-4 text-sm text-destructive" role="alert">Daftar pendaftar tidak dapat dimuat. Muat ulang untuk mencoba lagi.</p>
        ) : pendingQuery.data.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Tidak ada pendaftaran yang menunggu persetujuan.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {pendingQuery.data.map((account) => (
              <li key={account.userId} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="break-all text-sm font-medium">{account.email ?? "Email tidak tersedia"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Mendaftar {new Date(account.createdAt).toLocaleDateString("id-ID")}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" size="sm" onClick={() => reviewMutation.mutate({ userId: account.userId, status: "approved" })} disabled={reviewMutation.isPending}>
                    <Check /> Setujui
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => reviewMutation.mutate({ userId: account.userId, status: "rejected" })} disabled={reviewMutation.isPending}>
                    <X /> Tolak
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {reviewMutation.isError && <p className="mt-3 text-sm text-destructive" role="alert">Perubahan status gagal. Muat ulang daftar dan coba lagi.</p>}
      </div>
    </section>
  );
}
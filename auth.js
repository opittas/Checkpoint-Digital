// ══════════════════════════════════════════════════════════
// CONTAS — login com usuário + senha e sincronização do progresso
// Requer: shared.js, supabase-js (CDN) e conquistas-app.js (CK).
// O progresso continua salvo no navegador; com login ele também
// vai para a conta e aparece em qualquer aparelho.
// ══════════════════════════════════════════════════════════
const CK_AUTH = (function () {
  const FN = SUPA_URL + '/functions/v1/conta';
  const INTERNO = '@usuarios.checkpoint.invalid';
  const T = (pt, en) => (getLang() === 'en' ? en : pt);
  let sb = null;

  function client() {
    if (!sb && window.supabase && window.supabase.createClient) {
      sb = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'ck_auth' },
      });
    }
    return sb;
  }
  function usuario() {
    try { return JSON.parse(localStorage.getItem('ck_user')); } catch (e) { return null; }
  }
  async function sessao() {
    const c = client();
    if (!c) return null;
    const { data } = await c.auth.getSession();
    return data.session;
  }

  // ── Chamada à função do servidor ──
  async function chamar(acao, dados, token) {
    let r;
    try {
      r = await fetch(FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPA_KEY, Authorization: 'Bearer ' + (token || SUPA_KEY) },
        body: JSON.stringify(Object.assign({ acao }, dados)),
      });
    } catch (e) {
      throw new Error(T('Sem conexão com o servidor. Tente de novo em instantes.', 'Cannot reach the server. Try again shortly.'));
    }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.erro || T('Erro inesperado.', 'Unexpected error.'));
    return d;
  }

  // ── Progresso local ──
  function idsLocais() {
    const ids = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('ck_prog_') && k !== 'ck_prog_owner') ids.push(k.slice(8));
    }
    return ids;
  }
  function limparLocal() {
    const apagar = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('ck_prog_') || k.startsWith('ck_ts_') || k === 'ck_lib' || k === 'ck_lib_sync')) apagar.push(k);
    }
    apagar.forEach(k => localStorage.removeItem(k));
  }

  async function aplicarSessao(d) {
    const { error } = await client().auth.setSession({ access_token: d.sessao.access_token, refresh_token: d.sessao.refresh_token });
    if (error) throw new Error(T('Não foi possível iniciar a sessão.', 'Could not start the session.'));
    marcarDono(d.sessao.user_id, d.usuario);
    await sincronizarTudo();
  }
  function marcarDono(uid, nome) {
    const dono = localStorage.getItem('ck_prog_owner');
    if (dono && dono !== uid) limparLocal();       // progresso de outra conta neste navegador
    localStorage.setItem('ck_prog_owner', uid);
    localStorage.setItem('ck_user', JSON.stringify({ usuario: nome, id: uid }));
  }

  // ── Ações de conta ──
  async function cadastrar(nome, senha, email) {
    const d = await chamar('cadastrar', { usuario: nome, senha, email });
    if (!d.sessao) throw new Error(T('Conta criada, mas não consegui entrar. Tente fazer login.', 'Account created, but login failed. Please sign in.'));
    await aplicarSessao(d);
    return d.usuario;
  }
  async function entrar(nome, senha) {
    const d = await chamar('entrar', { usuario: nome, senha });
    await aplicarSessao(d);
    return d.usuario;
  }
  async function sair() {
    try { await client().auth.signOut(); } catch (e) {}
    limparLocal();
    localStorage.removeItem('ck_user');
    localStorage.removeItem('ck_prog_owner');
  }
  async function definirEmail(email) {
    const s = await sessao();
    if (!s) throw new Error(T('Sua sessão expirou. Entre novamente.', 'Your session expired. Sign in again.'));
    await chamar('definir_email', { email }, s.access_token);
    await client().auth.refreshSession();
  }
  async function trocarSenha(senha) {
    const { error } = await client().auth.updateUser({ password: senha });
    if (error) throw new Error(/different|same/i.test(error.message)
      ? T('A nova senha precisa ser diferente da atual.', 'The new password must be different.')
      : T('Não foi possível trocar a senha.', 'Could not change the password.'));
  }
  async function recuperarSenha(email) {
    const { error } = await client().auth.resetPasswordForEmail(email.trim(), { redirectTo: SITE_ROOT + 'conta.html' });
    if (error) throw new Error(/rate|limit/i.test(error.message)
      ? T('Muitos pedidos seguidos. Espere alguns minutos e tente de novo.', 'Too many requests. Wait a few minutes.')
      : T('Não foi possível enviar o e-mail.', 'Could not send the e-mail.'));
  }
  async function conta() {
    const s = await sessao();
    if (!s) return null;
    const { data } = await client().from('perfis').select('username, criado_em').eq('id', s.user.id).maybeSingle();
    if (data && (!usuario() || usuario().id !== s.user.id)) marcarDono(s.user.id, data.username);
    const email = s.user.email && !s.user.email.endsWith(INTERNO) ? s.user.email : null;
    return { id: s.user.id, usuario: data ? data.username : null, criado_em: data && data.criado_em, email,
             semPerfil: !data, sugestao: sugestaoNome(s.user) };
  }
  function sugestaoNome(u) {
    const m = (u && u.user_metadata) || {};
    const base = String(m.preferred_username || m.user_name || m.full_name || m.name || (u.email || '').split('@')[0] || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_.]/g, '').slice(0, 20);
    return base.length >= 3 ? base : '';
  }
  async function criarPerfil(nome) {
    const s = await sessao();
    if (!s) throw new Error(T('Sua sessão expirou. Entre novamente.', 'Your session expired. Sign in again.'));
    if (!/^[A-Za-z0-9_.]{3,20}$/.test(nome)) throw new Error(T('O nome de usuário deve ter de 3 a 20 caracteres (letras, números, _ ou .).', 'Username must be 3–20 characters (letters, numbers, _ or .).'));
    const { error } = await client().from('perfis').insert({ id: s.user.id, username: nome });
    if (error) throw new Error(error.code === '23505' ? T('Esse nome de usuário já está em uso.', 'That username is taken.') : T('Não foi possível salvar o nome.', 'Could not save the username.'));
    marcarDono(s.user.id, nome);
    await sincronizarTudo();
    return nome;
  }

  // ── Login social (Google, Apple, Discord) ──
  const SOCIAIS = { google: 'Google', apple: 'Apple', discord: 'Discord' };
  let _prov = null;
  function provedores() {     // só aparecem os que estiverem ativados no Supabase
    if (!_prov) {
      _prov = fetch(SUPA_URL + '/auth/v1/settings', { headers: { apikey: SUPA_KEY } })
        .then(r => r.json()).then(d => Object.keys(SOCIAIS).filter(p => d.external && d.external[p]))
        .catch(() => []);
    }
    return _prov;
  }
  async function entrarCom(provider) {
    const { error } = await client().auth.signInWithOAuth({ provider, options: { redirectTo: SITE_ROOT + 'conta.html' } });
    if (error) throw new Error(T('Não foi possível abrir o login.', 'Could not open the sign-in.'));
  }
  async function identidades() {
    const { data } = await client().auth.getUserIdentities();
    return (data && data.identities) || [];
  }
  async function vincularProvedor(provider) {
    const { error } = await client().auth.linkIdentity({ provider, options: { redirectTo: SITE_ROOT + 'conta.html' } });
    if (error) throw new Error(/manual linking|disabled/i.test(error.message)
      ? T('A vinculação de contas ainda não foi ativada no site.', 'Account linking is not enabled yet.')
      : T('Não foi possível vincular.', 'Could not link the account.'));
  }
  async function desvincularProvedor(identity) {
    const { error } = await client().auth.unlinkIdentity(identity);
    if (error) throw new Error(T('Não foi possível desvincular. A conta precisa de pelo menos uma forma de login.', 'Could not unlink. The account needs at least one sign-in method.'));
  }

  // ── Contas de jogos (Steam verificada; Xbox/PSN/Nintendo informadas) ──
  async function vinculos() {
    const { data } = await client().from('contas_vinculadas').select('plataforma, id_externo, nome, avatar, verificado, importado_em');
    const out = {};
    (data || []).forEach(v => { out[v.plataforma] = v; });
    return out;
  }
  async function salvarVinculoManual(plataforma, id) {
    const s = await sessao();
    id = String(id || '').trim().slice(0, 64);
    if (!id) {
      await client().from('contas_vinculadas').delete().eq('user_id', s.user.id).eq('plataforma', plataforma);
      return;
    }
    const { error } = await client().from('contas_vinculadas')
      .upsert({ user_id: s.user.id, plataforma, id_externo: id, nome: id, verificado: false, atualizado_em: new Date().toISOString() });
    if (error) throw new Error(T('Não foi possível salvar.', 'Could not save.'));
  }
  async function chamarSteam(acao, dados) {
    const s = await sessao();
    if (!s) throw new Error(T('Entre na sua conta primeiro.', 'Sign in first.'));
    let r;
    try {
      r = await fetch(SUPA_URL + '/functions/v1/steam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPA_KEY, Authorization: 'Bearer ' + s.access_token },
        body: JSON.stringify(Object.assign({ acao }, dados)),
      });
    } catch (e) { throw new Error(T('Sem conexão com o servidor.', 'Cannot reach the server.')); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const err = new Error(d.erro || T('Erro inesperado.', 'Unexpected error.')); err.dados = d; throw err; }
    return d;
  }
  function urlSteam() {
    const volta = SITE_ROOT + 'conta.html?steam=retorno';
    const q = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': volta,
      'openid.realm': new URL(SITE_ROOT).origin + '/',
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    });
    return 'https://steamcommunity.com/openid/login?' + q.toString();
  }
  async function concluirSteam(params) {
    const p = {};
    params.forEach((v, k) => { if (k.startsWith('openid.')) p[k] = v; });
    return chamarSteam('vincular', { params: p });
  }
  async function importarSteam() {
    const d = await chamarSteam('importar', {});
    await sincronizarTudo();
    return d;
  }
  function aoRecuperarSenha(cb) {
    const c = client();
    if (c) c.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') cb(); });
  }

  // ── Sincronização ──
  // Regra: em cada jogo vale a versão mais recente (navegador × conta).
  // Progresso antigo, de antes do login, é somado ao da conta.
  async function sincronizarTudo() {
    const s = await sessao();
    if (!s || !window.CK) return false;
    const { data, error } = await client().from('progresso').select('game_id, dados, atualizado_em');
    if (error) return false;
    const remotos = {};
    data.forEach(r => { remotos[r.game_id] = r; });
    const enviar = [];
    const agora = new Date().toISOString();
    new Set(Object.keys(remotos).concat(idsLocais())).forEach(gid => {
      const r = remotos[gid];
      const temLocal = localStorage.getItem('ck_prog_' + gid) !== null;
      const local = CK.getProg(gid);
      const ts = localStorage.getItem('ck_ts_' + gid);
      if (!r) { if (temLocal && Object.keys(local).length) enviar.push([gid, local, ts || agora]); return; }
      if (!temLocal) { CK.setProg(gid, r.dados, { ts: r.atualizado_em }); return; }
      if (!ts) {                                   // progresso de antes do login: soma
        const junto = Object.assign({}, r.dados, local);
        CK.setProg(gid, junto, { ts: agora });
        enviar.push([gid, junto, agora]);
      } else if (new Date(ts) > new Date(r.atualizado_em)) {
        enviar.push([gid, local, ts]);
      } else {
        CK.setProg(gid, r.dados, { ts: r.atualizado_em });
      }
    });
    if (enviar.length) {
      await client().from('progresso').upsert(
        enviar.map(([gid, dados, t]) => ({ user_id: s.user.id, game_id: gid, dados, atualizado_em: t })));
    }
    await sincronizarBiblioteca(s);
    return true;
  }

  async function sincronizarBiblioteca(s) {
    const { data, error } = await client().from('biblioteca').select('game_id, plataformas, status, favorito, origem, atualizado_em');
    if (error) return;
    const local = CK.getLib();
    const ultimo = localStorage.getItem('ck_lib_sync');
    const remotos = {};
    data.forEach(r => { remotos[r.game_id] = r; });
    const enviar = [];
    new Set(Object.keys(remotos).concat(Object.keys(local))).forEach(gid => {
      const r = remotos[gid], l = local[gid];
      const deRemoto = r && { plataformas: r.plataformas, status: r.status, favorito: r.favorito, origem: r.origem, ts: r.atualizado_em };
      if (r && !l) { local[gid] = deRemoto; return; }
      if (l && !r) {
        if (ultimo && l.ts && new Date(l.ts) <= new Date(ultimo)) delete local[gid];   // removido em outro aparelho
        else enviar.push([gid, l]);
        return;
      }
      if (new Date(l.ts || 0) > new Date(r.atualizado_em)) enviar.push([gid, l]);
      else local[gid] = deRemoto;
    });
    CK.saveLib(local);
    if (enviar.length) {
      await client().from('biblioteca').upsert(enviar.map(([gid, l]) => ({
        user_id: s.user.id, game_id: gid, plataformas: l.plataformas || [], status: l.status || 'jogando',
        favorito: !!l.favorito, origem: l.origem || 'manual', atualizado_em: l.ts || new Date().toISOString() })));
    }
    localStorage.setItem('ck_lib_sync', new Date().toISOString());
  }

  async function salvarLib(gid, item) {
    if (!usuario()) return;
    const s = await sessao();
    if (!s) return;
    const q = client().from('biblioteca');
    const { error } = item
      ? await q.upsert({ user_id: s.user.id, game_id: gid, plataformas: item.plataformas || [], status: item.status || 'jogando',
                         favorito: !!item.favorito, origem: item.origem || 'manual', atualizado_em: item.ts })
      : await q.delete().eq('user_id', s.user.id).eq('game_id', gid);
    if (error && window.CK) CK.toast(T('Sem conexão: a lista será enviada depois.', 'Offline: list will sync later.'));
  }
  // Sincroniza sem travar a página se o servidor estiver lento/fora do ar
  function sincronizarRapido(ms) {
    if (!usuario()) return Promise.resolve(false);
    return Promise.race([sincronizarTudo().catch(() => false), new Promise(r => setTimeout(() => r(false), ms || 3500))]);
  }

  const pendentes = {};
  function salvar(gid, dados, ts) {
    if (!usuario()) return;
    clearTimeout(pendentes[gid]);
    pendentes[gid] = setTimeout(async () => {
      delete pendentes[gid];
      const s = await sessao();
      if (!s) return;
      const { error } = await client().from('progresso')
        .upsert({ user_id: s.user.id, game_id: gid, dados, atualizado_em: ts });
      if (error && window.CK) CK.toast(T('Sem conexão: o progresso será enviado depois.', 'Offline: progress will sync later.'));
    }, 500);
  }

  return { usuario, sessao, cadastrar, entrar, sair, definirEmail, trocarSenha, recuperarSenha,
           conta, criarPerfil, aoRecuperarSenha, sincronizarTudo, sincronizarRapido, salvar, salvarLib,
           SOCIAIS, provedores, entrarCom, identidades, vincularProvedor, desvincularProvedor,
           vinculos, salvarVinculoManual, urlSteam, concluirSteam, importarSteam, chamarSteam };
})();

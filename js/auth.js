/**
 * Quetzal AI — Manejo de autenticación con Supabase
 */

const auth = {

  // -----------------------------
  //   INICIALIZACIÓN
  // -----------------------------

  _client: null,

  _getClient() {
    if (!this._client) {
      if (!window.supabase) {
        throw new Error('Supabase SDK no cargado');
      }
      this._client = window.supabase.createClient(
        QUETZAL_CONFIG.SUPABASE_URL,
        QUETZAL_CONFIG.SUPABASE_ANON_KEY
      );
    }
    return this._client;
  },


  // -----------------------------
  //   ALTERNAR FORMULARIO LOGIN/REGISTER
  // -----------------------------

  toggleForm(form) {
    document.getElementById("form-login").style.display = form === 'login' ? 'block' : 'none';
    document.getElementById("form-register").style.display = form === 'register' ? 'block' : 'none';
    this._clearMessages();
  },

  _clearMessages() {
    ['login-error', 'register-error', 'register-success'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.style.display = 'none'; el.textContent = ''; }
    });
  },

  _showError(id, message) {
    const el = document.getElementById(id);
    if (el) { el.textContent = '⚠️ ' + message; el.style.display = 'block'; }
  },

  _showSuccess(id, message) {
    const el = document.getElementById(id);
    if (el) { el.textContent = '✅ ' + message; el.style.display = 'block'; }
  },


  // -----------------------------
  //   LOGIN
  // -----------------------------

  async login() {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const btn = document.getElementById("login-btn");

    this._clearMessages();

    if (!email || !password) {
      this._showError('login-error', 'Completá todos los campos');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Iniciando sesión...';

    try {
      const client = this._getClient();
      const { data, error } = await client.auth.signInWithPassword({ email, password });

      if (error) throw error;

      // Guardar info del usuario en caché para UX
      localStorage.setItem(QUETZAL_CONFIG.STORAGE_KEYS.USER_CACHE, JSON.stringify({
        email: data.user.email,
        id: data.user.id
      }));

      // Redirigir al panel
      window.location.href = 'admin.html';

    } catch (error) {
      console.error('[Login]', error);
      let msg = error.message || 'Error al iniciar sesión';
      if (msg.includes('Invalid login')) msg = 'Email o contraseña incorrectos';
      this._showError('login-error', msg);
      btn.disabled = false;
      btn.textContent = 'Iniciar sesión';
    }
  },


  // -----------------------------
  //   REGISTRO
  // -----------------------------

  async register() {
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;
    const password2 = document.getElementById("register-password2").value;
    const btn = document.getElementById("register-btn");

    this._clearMessages();

    if (!email || !password || !password2) {
      this._showError('register-error', 'Completá todos los campos');
      return;
    }
    if (password.length < 6) {
      this._showError('register-error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== password2) {
      this._showError('register-error', 'Las contraseñas no coinciden');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Creando cuenta...';

    try {
      const client = this._getClient();
      const { data, error } = await client.auth.signUp({ email, password });

      if (error) throw error;

      // Como desactivamos "Confirm email", el usuario ya está logueado
      if (data.session) {
        localStorage.setItem(QUETZAL_CONFIG.STORAGE_KEYS.USER_CACHE, JSON.stringify({
          email: data.user.email,
          id: data.user.id
        }));
        window.location.href = 'admin.html?welcome=1';
      } else {
        // Caso poco común: la confirmación está activada
        this._showSuccess('register-success', 'Cuenta creada. Revisá tu email para confirmar.');
        btn.disabled = false;
        btn.textContent = 'Crear cuenta';
      }

    } catch (error) {
      console.error('[Register]', error);
      let msg = error.message || 'Error al crear cuenta';
      if (msg.includes('already registered')) msg = 'Este email ya está registrado. Iniciá sesión en su lugar.';
      this._showError('register-error', msg);
      btn.disabled = false;
      btn.textContent = 'Crear cuenta';
    }
  },


  // -----------------------------
  //   LOGOUT
  // -----------------------------

  async logout() {
    try {
      const client = this._getClient();
      await client.auth.signOut();
      localStorage.removeItem(QUETZAL_CONFIG.STORAGE_KEYS.USER_CACHE);
      localStorage.removeItem(QUETZAL_CONFIG.STORAGE_KEYS.BUSINESS_CACHE);
      window.location.href = 'login.html';
    } catch (error) {
      console.error('[Logout]', error);
      // Forzar limpieza igualmente
      localStorage.clear();
      window.location.href = 'login.html';
    }
  },


  // -----------------------------
  //   OBTENER USUARIO ACTUAL (sesión activa)
  // -----------------------------

  async getCurrentUser() {
    try {
      const client = this._getClient();
      const { data: { session } } = await client.auth.getSession();
      return session?.user || null;
    } catch (error) {
      console.error('[getCurrentUser]', error);
      return null;
    }
  },

  async getAccessToken() {
    try {
      const client = this._getClient();
      const { data: { session } } = await client.auth.getSession();
      return session?.access_token || null;
    } catch (error) {
      return null;
    }
  },


  // -----------------------------
  //   PROTEGER PÁGINA (redirige si no hay sesión)
  // -----------------------------

  async requireAuth() {
    const user = await this.getCurrentUser();
    if (!user) {
      window.location.href = 'login.html';
      return null;
    }
    return user;
  }
};
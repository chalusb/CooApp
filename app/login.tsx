import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  SafeAreaView,
  Alert,
  Switch,
} from "react-native";
// import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";

const { width, height } = Dimensions.get("window");

// ⚠️ CONFIGURACIÓN DE DESARROLLO ⚠️
// Cambiar a false para activar el login en producción
const DEV_BYPASS_LOGIN = true;

// Estado global simple para persistir configuración (mejorar con AsyncStorage después)
let globalLoginState = {
  hasLoggedInBefore: false,
  biometricEnabled: false,
};

// Función para resetear solo la sesión (mantener configuración de huella)
export const resetLoginState = () => {
  // NO reseteamos biometricEnabled para mantener la preferencia del usuario
  // globalLoginState.biometricEnabled = false; // ❌ Comentado para mantener configuración
  globalLoginState.hasLoggedInBefore = true; // ✅ Mantener como true para que aparezca huella
};

// Función para limpiar los campos del formulario cuando se regresa al login
export const clearLoginForm = () => {
  return { email: '', password: '' };
};

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoggedInBefore, setHasLoggedInBefore] = useState(globalLoginState.hasLoggedInBefore);
  const [biometricEnabled, setBiometricEnabled] = useState(globalLoginState.biometricEnabled);
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);

  useEffect(() => {
    (async () => {
      // ⚠️ BYPASS DE DESARROLLO ⚠️
      if (DEV_BYPASS_LOGIN) {
        console.log("🚀 DEV MODE: Saltando login automáticamente");
        router.replace("/(tabs)");
        return;
      }

      // Verificar soporte biométrico
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setIsBiometricSupported(compatible && enrolled);

      // Limpiar campos del formulario
      setEmail('');
      setPassword('');
      setErrorMessage('');
    })();
  }, []);

  const handleTogglePassword = () => setShowPassword(!showPassword);

  const handleLogin = async () => {
    setIsLoading(true);
    setErrorMessage("");

    // Validar credenciales
    if (email === "admin" && password === "123") {
      console.log("Login exitoso");

      // Si es la primera vez y hay soporte biométrico, mostrar configuración
      if (!globalLoginState.hasLoggedInBefore && isBiometricSupported) {
        globalLoginState.hasLoggedInBefore = true;
        setHasLoggedInBefore(true);
        setShowBiometricSetup(true);
      } else {
        // Si ya configuró antes o no hay soporte biométrico, navegar directamente
        router.replace("/(tabs)");
      }
    } else {
      setErrorMessage("Usuario o contraseña incorrectos");
    }

    setIsLoading(false);
  };

  const toggleBiometric = (value: boolean) => {
    globalLoginState.biometricEnabled = value;
    setBiometricEnabled(value);
    // Aquí se puede agregar AsyncStorage después de instalar la dependencia
  };

  const continueToDashboard = () => {
    router.replace("/(tabs)");
  };

  const skipBiometricSetup = () => {
    setShowBiometricSetup(false);
    router.replace("/(tabs)");
  };

  const handleBiometricAuth = async () => {
    try {
      const biometricAuth = await LocalAuthentication.authenticateAsync({
        promptMessage: "Autentícate para acceder",
        fallbackLabel: "Usar contraseña",
        cancelLabel: "Cancelar",
      });

      if (biometricAuth.success) {
        router.replace("/(tabs)");
      } else {
        Alert.alert("Error", "No se pudo autenticar");
      }
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "No se pudo autenticar con biometría");
    }
  };

  const isFormValid = email.length > 0 && password.length > 0;

  // Si el bypass está desactivado, mostrar loading hasta que redirija
  if (DEV_BYPASS_LOGIN) {
    return (
      <SafeAreaView style={[styles.container, styles.devContainer]}>
        <View style={styles.devContent}>
          <View style={styles.devBanner}>
            <Ionicons name="warning" size={24} color="#F59E0B" />
            <Text style={styles.devTitle}>MODO DESARROLLO</Text>
          </View>
          <Text style={styles.devText}>Saltando login automáticamente...</Text>
          <Text style={styles.devSubtext}>
            Para activar el login, cambia DEV_BYPASS_LOGIN a false en login.tsx
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.content}>
            {/* Header Section */}
            <View style={styles.headerSection}>
              <LinearGradient
                colors={["#6366F1", "#8B5CF6"]}
                style={styles.avatarContainer}
              >
                <Ionicons name="person" size={32} color="white" />
              </LinearGradient>

              <View style={styles.titleContainer}>
                <Text style={styles.title}>Bienvenido</Text>
              </View>
            </View>

            {/* Biometric Setup Screen */}
            {showBiometricSetup ? (
              <View style={styles.formCard}>
                <View style={styles.formContainer}>
                  <View style={styles.successContainer}>
                    <Ionicons
                      name="checkmark-circle"
                      size={64}
                      color="#10B981"
                    />
                    <Text style={styles.successTitle}>¡Login exitoso!</Text>
                    <Text style={styles.successSubtitle}>
                      ¿Te gustaría habilitar la autenticación con huella
                      dactilar para futuros accesos?
                    </Text>
                  </View>

                  <View style={styles.biometricToggle}>
                    <View style={styles.toggleInfo}>
                      <Ionicons name="finger-print" size={20} color="#6366F1" />
                      <Text style={styles.toggleText}>
                        Habilitar autenticación biométrica
                      </Text>
                    </View>
                    <Switch
                      value={biometricEnabled}
                      onValueChange={toggleBiometric}
                      trackColor={{ false: "#E5E7EB", true: "#C7D2FE" }}
                      thumbColor={biometricEnabled ? "#6366F1" : "#9CA3AF"}
                    />
                  </View>

                  <View style={styles.setupButtons}>
                    <TouchableOpacity
                      style={styles.continueButton}
                      onPress={continueToDashboard}
                    >
                      <Text style={styles.continueButtonText}>Continuar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.skipButton}
                      onPress={skipBiometricSetup}
                    >
                      <Text style={styles.skipButtonText}>
                        Omitir por ahora
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              /* Login Form */
              <View style={styles.formCard}>
                <View style={styles.formContainer}>
                  {/* Email Input */}
                  <View style={styles.inputSection}>
                    {/* <Text style={styles.inputLabel}>Usuario o Email</Text> */}
                    <View style={styles.inputContainer}>
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color="#9CA3AF"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Ingresa tu usuario"
                        placeholderTextColor="#9CA3AF"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                      />
                    </View>
                  </View>

                  {/* Password Input */}
                  <View style={styles.inputSection}>
                    {/* <Text style={styles.inputLabel}>Contraseña</Text> */}
                    <View style={styles.inputContainer}>
                      <Ionicons
                        name="lock-closed-outline"
                        size={20}
                        color="#9CA3AF"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={[styles.textInput, styles.passwordInput]}
                        placeholder="Ingresa tu contraseña"
                        placeholderTextColor="#9CA3AF"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoComplete="password"
                      />
                      <TouchableOpacity
                        onPress={handleTogglePassword}
                        style={styles.passwordToggle}
                      >
                        <Ionicons
                          name={
                            showPassword ? "eye-off-outline" : "eye-outline"
                          }
                          size={20}
                          color="#9CA3AF"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Error Message */}
                  {errorMessage ? (
                    <View style={styles.errorContainer}>
                      <Ionicons name="alert-circle" size={16} color="#EF4444" />
                      <Text style={styles.errorText}>{errorMessage}</Text>
                    </View>
                  ) : null}

                  {/* Login Button */}
                  <TouchableOpacity
                    style={[
                      styles.loginButton,
                      (!isFormValid || isLoading) && styles.loginButtonDisabled,
                    ]}
                    onPress={handleLogin}
                    disabled={!isFormValid || isLoading}
                  >
                    <LinearGradient
                      colors={
                        isFormValid
                          ? ["#6366F1", "#8B5CF6"]
                          : ["#D1D5DB", "#9CA3AF"]
                      }
                      style={styles.loginButtonGradient}
                    >
                      <Text
                        style={[
                          styles.loginButtonText,
                          (!isFormValid || isLoading) &&
                            styles.loginButtonTextDisabled,
                        ]}
                      >
                        {isLoading ? "Ingresando..." : "Iniciar Sesión"}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Biometric Settings - Solo después del primer login */}
                  {hasLoggedInBefore && isBiometricSupported && (
                    <View style={styles.biometricContainer}>
                      <View style={styles.biometricToggle}>
                        <View style={styles.toggleInfo}>
                          <Ionicons
                            name="finger-print"
                            size={20}
                            color="#6366F1"
                          />
                          <Text style={styles.toggleText}>
                            Habilitar autenticación biométrica
                          </Text>
                        </View>
                        <Switch
                          value={biometricEnabled}
                          onValueChange={toggleBiometric}
                          trackColor={{ false: "#E5E7EB", true: "#C7D2FE" }}
                          thumbColor={biometricEnabled ? "#6366F1" : "#9CA3AF"}
                        />
                      </View>
                    </View>
                  )}

                  {/* Biometric Login Button - Solo si está habilitado */}
                  {hasLoggedInBefore &&
                    isBiometricSupported &&
                    biometricEnabled && (
                      <View style={styles.biometricLoginContainer}>
                        <View style={styles.divider}>
                          <View style={styles.dividerLine} />
                          <Text style={styles.dividerText}>o</Text>
                          <View style={styles.dividerLine} />
                        </View>

                        <TouchableOpacity
                          style={styles.biometricButton}
                          onPress={handleBiometricAuth}
                        >
                          <Ionicons
                            name="finger-print"
                            size={24}
                            color="#6366F1"
                          />
                          <Text style={styles.biometricText}>
                            Usar huella dactilar
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: "center",
    alignItems: "center",
    minHeight: height * 0.9,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 48,
    width: "100%",
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  titleContainer: {
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
  },
  formCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  formContainer: {
    gap: 24,
  },
  inputSection: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
  },
  passwordInput: {
    paddingRight: 12,
  },
  passwordToggle: {
    padding: 4,
  },
  forgotPasswordContainer: {
    alignItems: "flex-end",
  },
  forgotPasswordText: {
    fontSize: 14,
    color: "#6366F1",
    fontWeight: "500",
  },
  loginButton: {
    borderRadius: 12,
    marginTop: 16,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  loginButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  loginButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  loginButtonTextDisabled: {
    color: "#9CA3AF",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 32,
  },
  footerText: {
    fontSize: 14,
    color: "#6B7280",
  },
  footerLink: {
    fontSize: 14,
    color: "#6366F1",
    fontWeight: "600",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#EF4444",
    flex: 1,
  },
  biometricContainer: {
    marginTop: 20,
    gap: 16,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  dividerText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  biometricButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: "#6366F1",
    borderRadius: 12,
    backgroundColor: "white",
  },
  biometricText: {
    fontSize: 16,
    color: "#6366F1",
    fontWeight: "600",
  },
  biometricToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  toggleInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  toggleText: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "500",
    flex: 1,
  },
  biometricLoginContainer: {
    marginTop: 20,
    gap: 16,
  },
  successContainer: {
    alignItems: "center",
    marginBottom: 32,
    gap: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
  },
  successSubtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  setupButtons: {
    gap: 12,
    marginTop: 24,
  },
  continueButton: {
    borderRadius: 12,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: "#6366F1",
    borderRadius: 12,
  },
  skipButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  skipButtonText: {
    color: "#6B7280",
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
  // Estilos para modo desarrollo
  devContainer: {
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
  },
  devContent: {
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  devBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FBBF24",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  devTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#92400E",
  },
  devText: {
    fontSize: 16,
    color: "#92400E",
    textAlign: "center",
    fontWeight: "600",
  },
  devSubtext: {
    fontSize: 14,
    color: "#A16207",
    textAlign: "center",
    lineHeight: 20,
  },
});

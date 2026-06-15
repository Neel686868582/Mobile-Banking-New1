import React, { useState, useRef } from "react";
import {
  Camera,
  Shield,
  Bell,
  Key,
  User,
  Mail,
  Save,
  CreditCard,
  Eye,
  EyeOff,
  Check,
  X,
  Lock,
  CheckCircle2,
  ShieldCheck,
  Copy,
} from "lucide-react";
import {
  updateUserProfile,
  updateDepositRequestStatus,
} from "../lib/firebaseUtils";
import { auth, db } from "../lib/firebase";
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { toast } from "react-hot-toast";

export function Profile({
  userData,
  user,
  onComplete,
  initialTab = "personal",
}: {
  userData: any;
  user: string;
  onComplete: () => void;
  initialTab?:
    | "personal"
    | "security"
    | "notifications"
    | "password"
    | "virtualcard";
}) {
  const [activeTab, setActiveTab] = useState<
    "personal" | "security" | "password" | "notifications" | "virtualcard"
  >(initialTab);

  const [phoneVal, setPhoneVal] = useState(userData.phone || "+91 ");
  const [showCard, setShowCard] = useState(false);
  const [depositRequests, setDepositRequests] = useState<any[]>([]);
  const [reqLoading, setReqLoading] = useState(false);

  React.useEffect(() => {
    if (activeTab === "notifications") {
      loadRequests();
    }
  }, [activeTab]);

  const loadRequests = async () => {
    try {
      const snap = await getDocs(
        query(
          collection(db, "users", user, "deposit_requests"),
          where("status", "in", ["pending", "approved"]),
        ),
      );
      setDepositRequests(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => {
            const timeA =
              a.timestamp || (a.date ? new Date(a.date).getTime() : 0);
            const timeB =
              b.timestamp || (b.date ? new Date(b.date).getTime() : 0);
            return timeB - timeA;
          }),
      );
    } catch (e) {}
  };

  const handleRequestAction = async (
    reqId: string,
    status: "approved" | "rejected",
  ) => {
    setReqLoading(true);
    try {
      const data = await updateDepositRequestStatus(user, reqId, status);
      if (data && status === "approved") {
        toast.success(
          "Deposit Approved! Share the Authorization Code displayed below.",
          { duration: 5000 },
        );
      }
      await loadRequests();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update request");
    } finally {
      setReqLoading(false);
    }
  };

  React.useEffect(() => {
    if (userData.phone) {
      setPhoneVal(userData.phone);
    }
  }, [userData.phone]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (!val.startsWith("+91 ")) {
      // If user deletes part of +91, restore it
      if (val.startsWith("+91")) val = "+91 " + val.slice(3);
      else if (val.startsWith("+9")) val = "+91 " + val.slice(2);
      else if (val.startsWith("+")) val = "+91 " + val.slice(1);
      else val = "+91 " + val;
    }
    setPhoneVal(val);
  };

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState({ text: "", type: "" });
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaData, setMfaData] = useState<{
    secret: string;
    qrCode: string;
  } | null>(null);
  const [mfaToken, setMfaToken] = useState("");
  const [mfaMsg, setMfaMsg] = useState({ text: "", type: "" });

  const fileInput = useRef<HTMLInputElement>(null);

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ text: "", type: "" });
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const phoneInput = formData.get("phone") as string;

    // Only update the phone if it wasn't already successfully set
    // Wait, let's keep it robust
    let updateData: any = { name };

    if (!userData.phone || userData.phone.trim() === "") {
      if (phoneInput && phoneInput !== "+91 " && phoneInput.trim() !== "") {
        const numberPart = phoneInput.replace("+91 ", "").replace(/\s/g, "");
        if (numberPart.length !== 10) {
          setMsg({
            text: "Please enter a valid 10-digit mobile number.",
            type: "error",
          });
          setLoading(false);
          return;
        }

        try {
          const phoneQuery = query(
            collection(db, "users"),
            where("phone", "==", phoneInput),
          );
          const phoneDocs = await getDocs(phoneQuery);
          if (!phoneDocs.empty) {
            setMsg({
              text: "Phone number already used by another account.",
              type: "error",
            });
            setLoading(false);
            return;
          }
        } catch (e: any) {
          console.warn(
            "Could not verify phone uniqueness due to permissions",
            e,
          );
          // If rules prevent querying, we must allow the update to proceed
        }
        updateData.phone = phoneInput;
      }
    }

    try {
      await updateUserProfile(user, updateData);
      setMsg({ text: "Profile updated successfully!", type: "success" });
      onComplete();
    } catch (err) {
      setMsg({ text: "Failed to update profile", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) return;

    setPwdLoading(true);
    setPwdMsg({ text: "", type: "" });

    try {
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        oldPassword,
      );
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      setPwdMsg({ text: "Password updated successfully!", type: "success" });
      setOldPassword("");
      setNewPassword("");
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/invalid-credential") {
        setPwdMsg({ text: "Incorrect old password", type: "error" });
      } else {
        setPwdMsg({
          text: err.message || "Failed to update password",
          type: "error",
        });
      }
    } finally {
      setPwdLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        await updateUserProfile(user, { avatar: base64 });
        onComplete();
      };
      reader.readAsDataURL(file);
    }
  };

  const startMfaSetup = async () => {
    setMfaLoading(true);
    setMfaMsg({ text: "", type: "" });
    try {
      const resp = await fetch("/api/2fa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user }),
      });
      const data = await resp.json();
      if (data.success) {
        setMfaData({ secret: data.secret, qrCode: data.qrCode });
      }
    } catch (err) {
      setMfaMsg({ text: "Failed to start MFA setup", type: "error" });
    } finally {
      setMfaLoading(false);
    }
  };

  const verifyMfaSetup = async () => {
    if (!mfaData) return;
    setMfaLoading(true);
    setMfaMsg({ text: "", type: "" });
    try {
      const resp = await fetch("/api/2fa/verify-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, token: mfaToken, secret: mfaData.secret }),
      });
      const data = await resp.json();
      if (data.success) {
        await updateUserProfile(user, {
          twoFactorEnabled: true,
          twoFactorSecret: mfaData.secret,
        });
        setMfaMsg({ text: "2FA Enabled successfully!", type: "success" });
        setMfaData(null);
        setMfaToken("");
        onComplete();
      } else {
        setMfaMsg({ text: data.message, type: "error" });
      }
    } catch (err) {
      setMfaMsg({ text: "Failed to verify 2FA", type: "error" });
    } finally {
      setMfaLoading(false);
    }
  };

  const disableMfa = async () => {
    setMfaLoading(true);
    try {
      await fetch("/api/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user }),
      });
      await updateUserProfile(user, {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      });
      setMfaMsg({ text: "2FA Disabled", type: "success" });
    } catch (err) {
      setMfaMsg({ text: "Failed to disable 2FA", type: "error" });
    } finally {
      setMfaLoading(false);
    }
  };

  const tabs = [
    {
      id: "personal",
      label: "Personal Info",
      icon: <User className="w-5 h-5" />,
    },
    {
      id: "security",
      label: "Security & Privacy",
      icon: <Shield className="w-5 h-5" />,
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: <Bell className="w-5 h-5" />,
    },
    { id: "password", label: "Password", icon: <Key className="w-5 h-5" /> },
    {
      id: "virtualcard",
      label: "Virtual Debit Card",
      icon: <CreditCard className="w-5 h-5" />,
    },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex flex-col gap-6">
        {/* Navigation Tabs Card */}
        <div className="bg-[#16191F] border border-white/5 rounded-3xl p-3 flex flex-col shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all text-[15px] font-medium w-full text-left ${
                activeTab === tab.id
                  ? "bg-blue-500/10 text-blue-400"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Card */}
        <div className="w-full">
          {activeTab === "personal" && (
            <div className="bg-[#16191F] border border-white/5 rounded-3xl p-8 shadow-sm">
              <form onSubmit={handleUpdate} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2 font-medium">
                      Full Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <User className="w-[18px] h-[18px] text-gray-500" />
                      </div>
                      <input
                        name="name"
                        type="text"
                        defaultValue={userData.name}
                        className="w-full bg-[#0A0B0D] border border-transparent rounded-2xl py-4 pl-14 pr-5 text-white focus:border-blue-500/50 focus:outline-none transition-colors shadow-inner font-medium text-[15px]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2 font-medium">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <Mail className="w-[18px] h-[18px] text-gray-500" />
                      </div>
                      <input
                        type="email"
                        value={user}
                        disabled
                        className="w-full bg-[#0A0B0D] border border-transparent rounded-2xl py-4 pl-14 pr-5 text-white opacity-70 cursor-not-allowed text-[15px]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2 font-medium">
                      Phone Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <span className="text-gray-500 flex items-center justify-center">
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                          </svg>
                        </span>
                      </div>
                      <input
                        required
                        name="phone"
                        type="text"
                        maxLength={14}
                        value={phoneVal}
                        onChange={handlePhoneChange}
                        readOnly={
                          !!userData.phone && userData.phone.trim() !== ""
                        }
                        disabled={
                          !!userData.phone && userData.phone.trim() !== ""
                        }
                        placeholder="+91 98765 43210"
                        className={`w-full bg-[#0A0B0D] border border-transparent rounded-2xl py-4 pl-14 pr-5 text-white focus:border-blue-500/50 focus:outline-none transition-colors shadow-inner text-[15px] ${!!userData.phone && userData.phone.trim() !== "" ? "opacity-70 cursor-not-allowed" : ""}`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2 font-medium">
                      Account Number
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={userData.accountNumber || "8845 2210 9942"}
                        disabled
                        className="w-full bg-[#0A0B0D] border border-transparent rounded-2xl py-4 px-6 text-white opacity-70 cursor-not-allowed tracking-wider text-[15px]"
                      />
                    </div>
                  </div>
                </div>

                {msg.text && (
                  <div
                    className={`p-4 rounded-xl text-sm justify-center flex mt-6 ${msg.type === "error" ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"}`}
                  >
                    {msg.text}
                  </div>
                )}

                <div className="pt-2">
                  <button
                    disabled={loading}
                    type="submit"
                    className="w-full bg-[#1b64f2] hover:bg-blue-600 text-white font-medium py-4 rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-[15px]"
                  >
                    <Save className="w-5 h-5 flex-shrink-0" /> Save Changes
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === "security" && (
            <div className="bg-[#16191F] border border-white/5 rounded-3xl p-8 shadow-xl">
              <h3 className="text-xl font-semibold mb-4">
                Two-Factor Authentication (MFA)
              </h3>
              <p className="text-gray-400 text-sm mb-8 leading-relaxed max-w-xl">
                Secure your account by adding an extra layer of security. Once
                enabled, you'll need to enter a code from your Google
                Authenticator app to login.
              </p>

              {userData.twoFactorEnabled ? (
                <div className="flex flex-col gap-8 border border-white/5 bg-[#1C2028] p-8 md:p-10 rounded-3xl relative">
                  <div className="flex-1 w-full space-y-6 relative z-10">
                    <div>
                      <h4 className="text-xl xl:text-2xl text-white font-medium mb-2 border-b border-white/10 pb-3">
                        Security & Auth Policies
                      </h4>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between bg-black/40 p-5 rounded-2xl border border-white/5 shadow-inner">
                        <div>
                          <h4 className="text-white font-medium">
                            Require 2FA for Login
                          </h4>
                          <p className="text-sm text-gray-500 mt-1">
                            Ask for authenticator code when signing in
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={userData.require2FAForLogin !== false}
                            onChange={async () =>
                              await updateUserProfile(user, {
                                require2FAForLogin:
                                  userData.require2FAForLogin === false
                                    ? true
                                    : false,
                              })
                            }
                          />
                          <div className="w-11 h-6 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#B88A44]"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between bg-black/40 p-5 rounded-2xl border border-white/5 shadow-inner">
                        <div>
                          <h4 className="text-white font-medium">
                            Secure Transactions
                          </h4>
                          <p className="text-sm text-gray-500 mt-1">
                            Ask for code to verify Transfer, Deposit, and Bill
                            Pay
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={
                              userData.require2FAForTransactions === true
                            }
                            onChange={async () =>
                              await updateUserProfile(user, {
                                require2FAForTransactions:
                                  userData.require2FAForTransactions === true
                                    ? false
                                    : true,
                              })
                            }
                          />
                          <div className="w-11 h-6 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#B88A44]"></div>
                        </label>
                      </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                      <button
                        onClick={disableMfa}
                        disabled={mfaLoading}
                        className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-sm font-medium transition-all"
                      >
                        {mfaLoading
                          ? "Processing..."
                          : "Disable 2FA / Remove Protection"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-white/5 bg-[#0A0B0D] p-6 rounded-2xl">
                  {!mfaData ? (
                    <button
                      onClick={startMfaSetup}
                      disabled={mfaLoading}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3 rounded-xl transition-all"
                    >
                      {mfaLoading
                        ? "Loading..."
                        : "Enable Google Authenticator"}
                    </button>
                  ) : (
                    <div className="flex flex-col md:flex-row gap-8 items-center">
                      <div className="bg-white p-3 rounded-xl shrink-0">
                        <img
                          src={mfaData.qrCode}
                          alt="QR Code"
                          className="w-48 h-48"
                        />
                      </div>
                      <div className="flex-1 space-y-5 w-full">
                        <div>
                          <h4 className="font-semibold text-lg mb-1">
                            Scan this QR Code
                          </h4>
                          <p className="text-sm text-gray-500">
                            Open Google Authenticator and scan the code to link
                            your account.
                          </p>
                        </div>
                        <div className="bg-[#16191F] p-4 rounded-xl border border-white/5">
                          <p className="text-xs text-gray-400 mb-2 font-medium">
                            Or enter setup key manually:
                          </p>
                          <div className="flex items-center justify-between gap-2 bg-[#0A0B0D] p-3 rounded-lg border border-white/5 group">
                            <span className="text-[#B88A44] font-mono text-sm tracking-wider break-all">
                              {mfaData.secret}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(mfaData.secret);
                                toast.success("Setup key copied!");
                              }}
                              className="p-1.5 rounded-md hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                              title="Copy setup key"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                            Enter 6-digit verification code
                          </label>
                          <input
                            type="text"
                            value={mfaToken}
                            onChange={(e) =>
                              setMfaToken(
                                e.target.value
                                  .replace(/\D/g, "")
                                  .substring(0, 6),
                              )
                            }
                            placeholder="000000"
                            className="w-full max-w-[200px] bg-[#16191F] text-white border border-white/10 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors text-center text-xl tracking-[0.5em] font-mono"
                          />
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={verifyMfaSetup}
                            disabled={mfaLoading || mfaToken.length < 6}
                            className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50"
                          >
                            {mfaLoading ? "Verifying..." : "Verify & Enable"}
                          </button>
                          <button
                            onClick={() => setMfaData(null)}
                            className="px-6 py-3 border border-white/10 rounded-xl text-sm hover:bg-white/5 transition-all text-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {mfaMsg.text && (
                <div
                  className={`mt-6 p-4 rounded-xl text-sm justify-center flex ${mfaMsg.type === "error" ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"}`}
                >
                  {mfaMsg.text}
                </div>
              )}
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="bg-[#16191F] border border-white/5 rounded-3xl p-8 shadow-xl">
              <h3 className="text-xl font-semibold mb-6">Notifications</h3>
              {depositRequests.length > 0 && (
                <div className="mb-8 space-y-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-blue-400">
                    Action Required: Auth Requests
                  </h4>
                  {depositRequests.map((req) => (
                    <div
                      key={req.id}
                      className={`${req.status === "approved" ? "bg-green-900/10 border-green-500/30" : "bg-blue-900/20 border-blue-500/30"} border p-5 rounded-2xl flex flex-col gap-4`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                          <p className="text-white font-medium mb-1">
                            Deposit Request from {req.requesterName}
                          </p>
                          <p className="text-sm text-gray-300">
                            Amount: ₹{req.amount} (Total Deduction: ₹
                            {req.amountWithFee}) using card ending in **
                            {req.last4}
                          </p>
                        </div>

                        {req.status === "pending" && (
                          <div className="flex gap-2 w-full sm:w-auto">
                            <button
                              disabled={reqLoading}
                              onClick={() =>
                                handleRequestAction(req.id, "approved")
                              }
                              className="flex-1 sm:flex-none flex justify-center items-center gap-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-xl text-sm transition-all shadow-lg shadow-green-500/20"
                            >
                              <Check className="w-4 h-4" /> Approve
                            </button>
                            <button
                              disabled={reqLoading}
                              onClick={() =>
                                handleRequestAction(req.id, "rejected")
                              }
                              className="flex-1 sm:flex-none flex justify-center items-center gap-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold py-2 px-4 rounded-xl text-sm transition-all"
                            >
                              <X className="w-4 h-4" /> Reject
                            </button>
                          </div>
                        )}
                      </div>

                      {req.status === "approved" && (
                        <div className="bg-black/20 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border border-green-500/20 mt-2">
                          <div>
                            <p className="text-green-400 font-medium flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4" /> Approved
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Please share this authorization code with the
                              requester to complete the deposit.
                            </p>
                          </div>
                          <div className="bg-[#0A0B0D] px-6 py-3 rounded-xl border border-white/5">
                            <span className="font-mono text-2xl font-bold tracking-[0.2em] text-white">
                              {req.authCode}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!userData.notifications ||
              userData.notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[200px] text-center">
                  <Bell className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-300">
                    All caught up!
                  </h3>
                  <p className="text-sm text-gray-500 mt-2">
                    You have no new notifications.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {userData.notifications.map((n: any) => (
                    <div
                      key={n.id}
                      className={`p-5 rounded-2xl border transition-all ${
                        !n.read
                          ? "bg-[#1C2028] border-blue-500/30 shadow-lg"
                          : "bg-[#0A0B0D] border-white/5"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${!n.read ? "bg-blue-500" : "bg-transparent"}`}
                        />
                        <div className="flex-1">
                          <p
                            className={`text-sm ${!n.read ? "text-white font-medium" : "text-gray-300"}`}
                          >
                            {n.message}
                          </p>
                          <p className="text-xs text-gray-500 mt-2">
                            {new Date(n.date).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "password" && (
            <div className="bg-[#16191F] border border-white/5 rounded-3xl p-8 shadow-xl">
              <form
                onSubmit={handlePasswordChange}
                className="space-y-6 max-w-md"
              >
                <div>
                  <label className="block text-sm text-gray-400 mb-3">
                    Old Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Key className="w-5 h-5 text-gray-500" />
                    </div>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      required
                      className="w-full bg-[#0A0B0D] border border-transparent rounded-2xl py-4 pl-12 pr-5 focus:border-blue-500 focus:outline-none transition-colors text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-3">
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Key className="w-5 h-5 text-gray-500" />
                    </div>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full bg-[#0A0B0D] border border-transparent rounded-2xl py-4 pl-12 pr-5 focus:border-blue-500 focus:outline-none transition-colors text-white"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2 ml-1">
                    Must be at least 6 characters.
                  </p>
                </div>

                {pwdMsg.text && (
                  <div
                    className={`p-4 rounded-xl text-sm justify-center flex mt-6 ${pwdMsg.type === "error" ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"}`}
                  >
                    {pwdMsg.text}
                  </div>
                )}

                <div className="pt-4">
                  <button
                    disabled={pwdLoading}
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 rounded-2xl transition-all disabled:opacity-50"
                  >
                    {pwdLoading ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === "virtualcard" && (
            <div className="bg-[#16191F] border border-white/5 rounded-3xl p-8 shadow-xl">
              <h3 className="text-xl font-semibold mb-2">Virtual Debit Card</h3>
              <p className="text-sm text-gray-400 mb-8 max-w-sm">
                Your unique RupeePay virtual debit card. You can use these
                details to allow others to add money to your account safely.
              </p>

              {userData.virtualCard ? (
                <>
                  <div className="flex flex-col md:flex-row gap-8 items-start">
                    <div className="relative w-full max-w-[400px] min-h-[280px] rounded-2xl p-6 flex flex-col justify-between overflow-hidden shadow-2xl shrink-0 group">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-indigo-800 to-purple-900 z-0"></div>
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent z-0"></div>
                      <div className="absolute w-[200px] h-[200px] bg-blue-500/20 blur-3xl -bottom-10 -left-10 rounded-full z-0"></div>

                      <div className="relative z-10 flex justify-between items-start">
                        <div className="font-bold text-xl tracking-wider text-white">
                          RupeePay
                        </div>
                        <div className="text-xl italic font-bold text-white/90">
                          {userData.virtualCard.network}
                        </div>
                      </div>

                      <div className="relative z-10 mt-6">
                        <img
                          src="https://upload.wikimedia.org/wikipedia/commons/a/a4/EMV_chip_silver.png"
                          alt="chip"
                          className="w-12 h-10 object-contain opacity-80"
                        />
                      </div>

                      <div className="relative z-10 mt-2">
                        <div className="font-mono text-xl sm:text-2xl text-white tracking-[0.1em] sm:tracking-[0.2em] font-medium text-shadow-sm">
                          {showCard
                            ? userData.virtualCard.cardNumber
                                .match(/.{1,4}/g)
                                ?.join(" ")
                            : `**** **** **** ${userData.virtualCard.cardNumber.slice(-4)}`}
                        </div>
                      </div>

                      <div className="relative z-10 flex justify-between items-end mt-4">
                        <div>
                          <div className="text-[10px] text-white/60 uppercase tracking-widest mb-1">
                            Card Holder
                          </div>
                          <div className="font-medium text-sm text-white uppercase tracking-wider">
                            {userData.virtualCard.name}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex gap-4">
                            <div className="text-left">
                              <div className="text-[9px] text-white/60 uppercase tracking-widest mb-1 leading-none">
                                Valid
                                <br />
                                Thru
                              </div>
                              <div className="font-mono text-sm text-white">
                                {showCard
                                  ? userData.virtualCard.expiry
                                  : "**/**"}
                              </div>
                            </div>
                            <div className="text-left">
                              <div className="text-[9px] text-white/60 uppercase tracking-widest mb-1 leading-none">
                                CVV
                              </div>
                              <div className="font-mono text-sm text-white">
                                {showCard ? userData.virtualCard.cvv : "***"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="relative z-10 mt-5 pt-4 border-t border-white/20 flex justify-between items-center">
                        <div className="text-[10px] text-white/80 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-blue-300" /> Card
                          ID
                        </div>
                        <div className="font-mono text-sm sm:text-base tracking-widest text-[#93C5FD] font-semibold bg-white/10 px-3 py-1 rounded-md backdrop-blur-sm">
                          {showCard
                            ? userData.virtualCard.cardId
                            : "RPAY******"}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 space-y-4 w-full">
                      <button
                        onClick={() => setShowCard(!showCard)}
                        className="flex items-center justify-center gap-2 w-full py-4 bg-[#232730] hover:bg-[#2A2F3A] text-white font-medium rounded-xl transition-all border border-white/5"
                      >
                        {showCard ? (
                          <EyeOff className="w-5 h-5 text-gray-400" />
                        ) : (
                          <Eye className="w-5 h-5 text-gray-400" />
                        )}
                        {showCard ? "Hide Card Details" : "Reveal Card Details"}
                      </button>

                      <button
                        onClick={() => {
                          if (userData.virtualCard?.cardId) {
                            navigator.clipboard.writeText(
                              userData.virtualCard.cardId,
                            );
                            toast.success("Card ID Copied!");
                          }
                        }}
                        className="flex items-center justify-center gap-2 w-full py-4 bg-[#232730] hover:bg-[#2A2F3A] text-white font-medium rounded-xl transition-all border border-white/5"
                      >
                        <Copy className="w-5 h-5 text-gray-400" /> Copy Card ID
                      </button>
                    </div>
                  </div>
                  <div className="mt-6 bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-sm text-blue-400 w-full">
                    Card details are unique to your account. Keep them secure.
                    Use these details to receive deposits from other users
                    securely via authorization codes.
                  </div>
                </>
              ) : (
                <div className="text-gray-500">
                  Generating virtual card... please wait or refresh.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

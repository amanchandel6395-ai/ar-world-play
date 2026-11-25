import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  Settings, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  QrCode, 
  Download, 
  ArrowLeft, 
  Save, 
  Image as ImageIcon,
  ExternalLink,
  Lock,
  Unlock,
  KeyRound
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Admin Panel • Zuitar Campaign" }],
  }),
  component: AdminPage,
});

interface Candidate {
  id: string;
  name: string;
  constituency: string;
  role: string;
  slogan: string;
  phone: string;
  photoUrl: string;
  isActive: boolean;
  createdAt: string;
}

function AdminPage() {
  const { toast } = useToast();

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem("zuitar_admin_auth") === "true";
    } catch {
      return false;
    }
  });
  const [inputPassword, setInputPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedQrCandidate, setSelectedQrCandidate] = useState<Candidate | null>(null);

  // Candidates state
  const [candidates, setCandidates] = useState<Candidate[]>(() => {
    try {
      const saved = localStorage.getItem("zuitar_admin_candidates");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [
      {
        id: "cand-1",
        name: "अमन पाल (Aman Pal)",
        constituency: "लखनऊ, उत्तर प्रदेश",
        role: "युवा नेता एवं प्रत्याशी",
        slogan: "सबका साथ, सबका विकास, सबका विश्वास",
        phone: "9068734941",
        photoUrl: "/assets/yogi.png",
        isActive: true,
        createdAt: new Date().toISOString()
      }
    ];
  });

  // New Candidate Form State
  const [newCandidate, setNewCandidate] = useState({
    name: "",
    constituency: "",
    role: "",
    slogan: "",
    phone: "",
    photoUrl: ""
  });

  // Global Settings state
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("zuitar_admin_settings");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return {
      enableYogi: true,
      enableModi: true,
      enableYogiGeneration: true,
      enableModiGeneration: true,
      enableBjpGeneration: true,
      enableBoothMode: true,
      enablePhoneMode: false,
      bjpTheme: true,
      aiEnhancement: true,
      contactPhone: "9068734941",
      contactEmail: "zuitaiofficial@gmail.com",
      contactLocation: "लखनऊ, उत्तर प्रदेश"
    };
  });

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (inputPassword === "admin123" || inputPassword === "bjp2024" || inputPassword === "aman9068") {
      setIsAuthenticated(true);
      localStorage.setItem("zuitar_admin_auth", "true");
      setPasswordError("");
      toast({
        title: "प्रवेश स्वीकृत (Logged In)",
        description: "एडमिन पैनल में आपका स्वागत है।"
      });
    } else {
      setPasswordError("पासवर्ड गलत है! (कृपया सही पासवर्ड दर्ज करें)");
      toast({
        title: "गलत पासवर्ड",
        description: "कृपया सही एडमिन पासवर्ड दर्ज करें।",
        variant: "destructive"
      });
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("zuitar_admin_auth");
    toast({
      title: "लॉगआउट हो गया",
      description: "एडमिन सत्र समाप्त हो गया।"
    });
  };

  const saveAll = () => {
    localStorage.setItem("zuitar_admin_candidates", JSON.stringify(candidates));
    localStorage.setItem("zuitar_admin_settings", JSON.stringify(settings));
    toast({
      title: "✅ सेटिंग्स सुरक्षित हो गईं!",
      description: "प्रत्याशी और सभी बदलाव सफलतापूर्वक सेव कर लिए गए हैं।"
    });
  };

  const handleAddCandidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCandidate.name.trim()) {
      toast({
        title: "नाम दर्ज करें",
        description: "कृपया प्रत्याशी का नाम भरें।",
        variant: "destructive"
      });
      return;
    }

    const created: Candidate = {
      id: `cand-${Date.now()}`,
      name: newCandidate.name.trim(),
      constituency: newCandidate.constituency.trim() || "उत्तर प्रदेश",
      role: newCandidate.role.trim() || "प्रत्याशी",
      slogan: newCandidate.slogan.trim() || "अबकी बार 400 पार, मोदी-योगी सरकार",
      phone: newCandidate.phone.trim() || "9068734941",
      photoUrl: newCandidate.photoUrl.trim() || "/assets/yogi.png",
      isActive: true,
      createdAt: new Date().toISOString()
    };

    const updated = [created, ...candidates];
    setCandidates(updated);
    localStorage.setItem("zuitar_admin_candidates", JSON.stringify(updated));

    setNewCandidate({
      name: "",
      constituency: "",
      role: "",
      slogan: "",
      phone: "",
      photoUrl: ""
    });

    toast({
      title: "🎉 नया प्रत्याशी जोड़ा गया!",
      description: `${created.name} के लिए पोस्टर व क्यूआर लिंक तैयार है।`
    });
  };

  const handleDeleteCandidate = (id: string) => {
    const updated = candidates.filter(c => c.id !== id);
    setCandidates(updated);
    localStorage.setItem("zuitar_admin_candidates", JSON.stringify(updated));
    toast({
      title: "हटा दिया गया",
      description: "प्रत्याशी सूची से हटा दिया गया है।"
    });
  };

  const handleToggleCandidate = (id: string) => {
    const updated = candidates.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c);
    setCandidates(updated);
    localStorage.setItem("zuitar_admin_candidates", JSON.stringify(updated));
  };

  const handleCopyLink = (candidate: Candidate) => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/?candidate=${encodeURIComponent(candidate.name)}&constituency=${encodeURIComponent(candidate.constituency)}&slogan=${encodeURIComponent(candidate.slogan)}`;
    navigator.clipboard.writeText(url);
    setCopiedId(candidate.id);
    setTimeout(() => setCopiedId(null), 2500);
    toast({
      title: "📋 लिंक कॉपी हो गया!",
      description: "यह लिंक व्हाट्सएप पर शेयर करें या क्यूआर कोड में डालें।"
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setNewCandidate(prev => ({ ...prev, photoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // IF NOT AUTHENTICATED: SHOW PASSWORD LOGIN GATE
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-orange-50/50 via-background to-green-50/30 text-foreground">
        <Card className="w-full max-w-md border-orange-200/80 shadow-xl bg-card">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 shadow-inner">
              <Lock className="h-7 w-7" />
            </div>
            <CardTitle className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              एडमिन लॉगिन (Admin Access)
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              यह सेक्शन केवल अधिकृत व्यवस्थापक के लिए है। कृपया पासवर्ड दर्ज करें।
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-3">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="admin-pass" className="text-xs font-semibold">
                  एडमिन पासवर्ड (Password)
                </Label>
                <div className="relative">
                  <Input
                    id="admin-pass"
                    type="password"
                    placeholder="पासवर्ड दर्ज करें..."
                    value={inputPassword}
                    onChange={(e) => {
                      setInputPassword(e.target.value);
                      setPasswordError("");
                    }}
                    className="pr-10"
                    autoFocus
                  />
                  <KeyRound className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
                {passwordError && (
                  <p className="text-xs text-destructive font-medium">{passwordError}</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  डिफ़ॉल्ट पासवर्ड: <code className="bg-muted px-1.5 py-0.5 rounded text-orange-700 font-mono">admin123</code>
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold">
                  <Unlock className="h-4 w-4 mr-2" />
                  लॉगिन करें (Unlock Panel)
                </Button>

                <Link to="/" className="block text-center">
                  <Button variant="ghost" type="button" className="w-full text-xs text-muted-foreground">
                    ← मुख्य होम पेज पर वापस जाएं
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // AUTHENTICATED: SHOW SYSTEMATIC 2-TAB DASHBOARD
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/50 via-background to-green-50/30 text-foreground pb-24">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-md shadow-xs">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon" className="rounded-full" title="होम पेज">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-orange-600 via-amber-600 to-green-600 bg-clip-text text-transparent">
                अभियान एडमिन पैनल (Admin Panel)
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                प्रत्याशी प्रबंधन एवं मुख्य अभियान सेटिंग्स
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs sm:text-sm">
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">लाइव साइट देखें</span>
                <span className="sm:hidden">साइट</span>
              </Button>
            </Link>
            <Button onClick={saveAll} size="sm" className="gap-1.5 bg-orange-600 hover:bg-orange-700 text-white font-medium text-xs sm:text-sm shadow-sm">
              <Save className="h-4 w-4" />
              <span>सेव करें</span>
            </Button>
            <Button onClick={handleLogout} variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive" title="लॉगआउट">
              लॉगआउट
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        <Tabs defaultValue="candidates" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 h-12 p-1 bg-muted/80 rounded-xl">
            <TabsTrigger value="candidates" className="flex items-center gap-2 text-sm sm:text-base font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs rounded-lg">
              <Users className="h-4 w-4 text-orange-600" />
              <span>👥 प्रत्याशी प्रबंधन ({candidates.length})</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2 text-sm sm:text-base font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs rounded-lg">
              <Settings className="h-4 w-4 text-amber-600" />
              <span>⚙️ मुख्य सेटिंग्स</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: CANDIDATES MANAGEMENT */}
          <TabsContent value="candidates" className="space-y-6">
            {/* Add Candidate Form Card */}
            <Card className="border-orange-200/60 shadow-xs bg-card/90">
              <CardHeader className="pb-3 border-b border-muted">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2 text-orange-700">
                  <Plus className="h-5 w-5" />
                  नया प्रत्याशी (Candidate) जोड़ें
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  प्रत्याशी का विवरण भरें। इसके बाद उनका अलग QR कोड और सेल्फी लिंक तुरंत तैयार हो जाएगा।
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={handleAddCandidate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="c-name" className="text-xs font-semibold">प्रत्याशी का पूरा नाम *</Label>
                    <Input
                      id="c-name"
                      placeholder="उदा. अमन पाल या श्री राम शर्मा"
                      value={newCandidate.name}
                      onChange={e => setNewCandidate(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="c-const" className="text-xs font-semibold">विधानसभा / लोकसभा क्षेत्र</Label>
                    <Input
                      id="c-const"
                      placeholder="उदा. लखनऊ मध्य, उत्तर प्रदेश"
                      value={newCandidate.constituency}
                      onChange={e => setNewCandidate(prev => ({ ...prev, constituency: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="c-role" className="text-xs font-semibold">पद / उपाधि</Label>
                    <Input
                      id="c-role"
                      placeholder="उदा. भाजपा प्रत्याशी / युवा मोर्चा"
                      value={newCandidate.role}
                      onChange={e => setNewCandidate(prev => ({ ...prev, role: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="c-phone" className="text-xs font-semibold">व्हाट्सएप / फोन नंबर</Label>
                    <Input
                      id="c-phone"
                      placeholder="9068734941"
                      value={newCandidate.phone}
                      onChange={e => setNewCandidate(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="c-slogan" className="text-xs font-semibold">चुनावी स्लोगन / नारा</Label>
                    <Input
                      id="c-slogan"
                      placeholder="उदा. एक ही विकल्प - मोदी सरकार, योगी सरकार"
                      value={newCandidate.slogan}
                      onChange={e => setNewCandidate(prev => ({ ...prev, slogan: e.target.value }))}
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-2">
                    <Label className="text-xs font-semibold">प्रत्याशी की फोटो (URL या डिवाइस से चुनें)</Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        placeholder="फोटो लिंक (https://...) या नीचे से अपलोड करें"
                        value={newCandidate.photoUrl}
                        onChange={e => setNewCandidate(prev => ({ ...prev, photoUrl: e.target.value }))}
                        className="flex-1"
                      />
                      <label className="cursor-pointer">
                        <Button type="button" variant="outline" className="w-full sm:w-auto gap-2">
                          <ImageIcon className="h-4 w-4" />
                          <span>फोटो अपलोड</span>
                        </Button>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="sm:col-span-2 pt-2">
                    <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5">
                      <Plus className="h-4 w-4 mr-2" />
                      प्रत्याशी जोड़ें और लिंक बनाएं
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Candidate List Card */}
            <div className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center justify-between">
                <span>वर्तमान प्रत्याशी सूची ({candidates.length})</span>
                <span className="text-xs font-normal text-muted-foreground">प्रत्येक प्रत्याशी का अलग लिंक उपलब्ध है</span>
              </h2>

              {candidates.length === 0 ? (
                <div className="text-center py-12 border rounded-xl bg-card text-muted-foreground">
                  <p>अभी कोई प्रत्याशी नहीं जोड़ा गया है। ऊपर दिए गए फॉर्म से जोड़ें।</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {candidates.map((cand) => (
                    <Card key={cand.id} className={`border transition-all shadow-xs ${cand.isActive ? "border-orange-200 bg-card" : "border-muted opacity-60 bg-muted/30"}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <img
                            src={cand.photoUrl || "/assets/yogi.png"}
                            alt={cand.name}
                            className="h-16 w-16 rounded-xl object-cover border border-orange-200 shadow-2xs shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/assets/yogi.png";
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <div>
                                <h3 className="font-bold text-sm sm:text-base text-foreground truncate">{cand.name}</h3>
                                <p className="text-xs text-orange-700 font-medium">{cand.role} • {cand.constituency}</p>
                              </div>
                              <Switch
                                checked={cand.isActive}
                                onCheckedChange={() => handleToggleCandidate(cand.id)}
                                title={cand.isActive ? "सक्रिय" : "निष्क्रिय"}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1 italic">
                              "{cand.slogan}"
                            </p>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="mt-4 pt-3 border-t border-muted/80 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopyLink(cand)}
                              className="text-xs h-8 gap-1.5"
                            >
                              {copiedId === cand.id ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-green-600" />
                                  <span className="text-green-600 font-medium">कॉपी हुआ!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" />
                                  <span>लिंक कॉपी</span>
                                </>
                              )}
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedQrCandidate(cand)}
                              className="text-xs h-8 gap-1.5"
                            >
                              <QrCode className="h-3.5 w-3.5 text-orange-600" />
                              <span>QR पोस्टर</span>
                            </Button>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCandidate(cand.id)}
                            className="text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10 px-2"
                            title="हटाएं"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 2: GLOBAL SETTINGS */}
          <TabsContent value="settings" className="space-y-6">
            <Card className="border-muted shadow-xs bg-card">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5 text-amber-600" />
                  मुख्य मोड एवं दृश्य सेटिंग्स (Core Toggles)
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  होम पेज और कैमरा पेज पर कौन-से मोड सक्रिय रहेंगे नियंत्रित करें।
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-5">
                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="font-semibold text-sm">सीएम योगी जी सीन (CM Yogi Ji Scene)</p>
                    <p className="text-xs text-muted-foreground">होम पेज पर सीएम योगी जी के साथ सेल्फी कार्ड दिखाएं</p>
                  </div>
                  <Switch
                    checked={settings.enableYogi}
                    onCheckedChange={v => setSettings((s: any) => ({ ...s, enableYogi: v }))}
                  />
                </div>

                <div className="flex items-center justify-between py-1 border-t pt-4">
                  <div>
                    <p className="font-semibold text-sm">पीएम मोदी जी सीन (PM Modi Ji Scene)</p>
                    <p className="text-xs text-muted-foreground">होम पेज पर पीएम नरेंद्र मोदी जी के साथ सेल्फी कार्ड दिखाएं</p>
                  </div>
                  <Switch
                    checked={settings.enableModi}
                    onCheckedChange={v => setSettings((s: any) => ({ ...s, enableModi: v }))}
                  />
                </div>

                {/* Politician AI Photo Generation Stop Controls */}
                <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4 space-y-3 dark:bg-orange-950/20 dark:border-orange-800">
                  <p className="text-xs font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400">
                    नेताओं की फोटो जेनरेशन नियंत्रण (Stop / Enable Generation)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    यहाँ से आप किसी भी नेता के साथ यूजर्स की AI फोटो जेनरेशन को तुरंत बंद या चालू कर सकते हैं।
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-orange-200/60 dark:border-orange-800/60">
                    <div>
                      <p className="font-semibold text-sm">सीएम योगी जी फोटो जेनरेशन (Yogi Ji Generation)</p>
                      <p className="text-xs text-muted-foreground">बंद करने पर यूजर्स योगी जी के साथ फोटो नहीं बना पाएंगे</p>
                    </div>
                    <Switch
                      checked={settings.enableYogiGeneration !== false}
                      onCheckedChange={v => setSettings((s: any) => ({ ...s, enableYogiGeneration: v }))}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-orange-200/60 dark:border-orange-800/60">
                    <div>
                      <p className="font-semibold text-sm">पीएम मोदी जी फोटो जेनरेशन (Modi Ji Generation)</p>
                      <p className="text-xs text-muted-foreground">बंद करने पर यूजर्स मोदी जी के साथ फोटो नहीं बना पाएंगे</p>
                    </div>
                    <Switch
                      checked={settings.enableModiGeneration !== false}
                      onCheckedChange={v => setSettings((s: any) => ({ ...s, enableModiGeneration: v }))}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-orange-200/60 dark:border-orange-800/60">
                    <div>
                      <p className="font-semibold text-sm">भाजपा लुक फोटो जेनरेशन (BJP Look Generation)</p>
                      <p className="text-xs text-muted-foreground">बंद करने पर यूजर्स भाजपा लुक वाली फोटो नहीं बना पाएंगे</p>
                    </div>
                    <Switch
                      checked={settings.enableBjpGeneration !== false}
                      onCheckedChange={v => setSettings((s: any) => ({ ...s, enableBjpGeneration: v }))}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between py-1 border-t pt-4">
                  <div>
                    <p className="font-semibold text-sm">मोबाइल फोन मोड (Phone Camera Mode)</p>
                    <p className="text-xs text-muted-foreground">स्मार्टफोन और टैबलेट के लिए ऑटो-ओरिएंटेशन व डायरेक्ट सोशल शेयरिंग ऑन रखें</p>
                  </div>
                  <Switch
                    checked={settings.enablePhoneMode}
                    onCheckedChange={v => setSettings((s: any) => ({ ...s, enablePhoneMode: v }))}
                  />
                </div>

                <div className="flex items-center justify-between py-1 border-t pt-4">
                  <div>
                    <p className="font-semibold text-sm">फोटो बूथ मोड (Photo Booth Mode)</p>
                    <p className="text-xs text-muted-foreground">इवेंट या कियोस्क के लिए हैंड्स-फ्री टाइमर व फुल-स्क्रीन मोड ऑन रखें</p>
                  </div>
                  <Switch
                    checked={settings.enableBoothMode}
                    onCheckedChange={v => setSettings((s: any) => ({ ...s, enableBoothMode: v }))}
                  />
                </div>

                <div className="flex items-center justify-between py-1 border-t pt-4">
                  <div>
                    <p className="font-semibold text-sm">भाजपा एवं भगवा थीम (BJP Saffron Theme)</p>
                    <p className="text-xs text-muted-foreground">कमल का निशान, तिरंगा बॉर्डर और भगवा हाईलाइट्स एक्टिव रखें</p>
                  </div>
                  <Switch
                    checked={settings.bjpTheme}
                    onCheckedChange={v => setSettings((s: any) => ({ ...s, bjpTheme: v }))}
                  />
                </div>

                <div className="flex items-center justify-between py-1 border-t pt-4">
                  <div>
                    <p className="font-semibold text-sm">AI स्टाइलिंग एवं ब्यूटी फिल्टर (AI Styling)</p>
                    <p className="text-xs text-muted-foreground">चेहरे की रोशनी और बैकग्राउंड को वास्तविक नेता के साथ संतुलित करें</p>
                  </div>
                  <Switch
                    checked={settings.aiEnhancement}
                    onCheckedChange={v => setSettings((s: any) => ({ ...s, aiEnhancement: v }))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Campaign & Contact Details Card */}
            <Card className="border-muted shadow-xs bg-card">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base sm:text-lg">संपर्क एवं अभियान विवरण (Contact Info)</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  यह जानकारी फुटर और व्हाट्सएप सपोर्ट बटन में प्रदर्शित होती है।
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">फोन / व्हाट्सएप नंबर</Label>
                  <Input
                    value={settings.contactPhone}
                    onChange={e => setSettings((s: any) => ({ ...s, contactPhone: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">ईमेल आईडी</Label>
                  <Input
                    value={settings.contactEmail}
                    onChange={e => setSettings((s: any) => ({ ...s, contactEmail: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold">स्थान / पता</Label>
                  <Input
                    value={settings.contactLocation}
                    onChange={e => setSettings((s: any) => ({ ...s, contactLocation: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* QR Code Poster Modal */}
      {selectedQrCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-background rounded-2xl max-w-sm w-full p-6 text-center space-y-4 border border-orange-200 shadow-xl">
            <h3 className="font-bold text-lg text-orange-700">
              {selectedQrCandidate.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              यह QR कोड स्कैन करने पर सीधा प्रत्याशी के साथ मोदी-योगी जी का सेल्फी कैमरा खुलेगा।
            </p>

            <div className="p-4 bg-white rounded-xl border inline-block shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  `${window.location.origin}/?candidate=${encodeURIComponent(selectedQrCandidate.name)}&constituency=${encodeURIComponent(selectedQrCandidate.constituency)}&slogan=${encodeURIComponent(selectedQrCandidate.slogan)}`
                )}`}
                alt="Candidate QR"
                className="w-48 h-48 mx-auto"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSelectedQrCandidate(null)}
              >
                बंद करें
              </Button>
              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(
                  `${window.location.origin}/?candidate=${encodeURIComponent(selectedQrCandidate.name)}&constituency=${encodeURIComponent(selectedQrCandidate.constituency)}&slogan=${encodeURIComponent(selectedQrCandidate.slogan)}`
                )}`}
                download={`${selectedQrCandidate.name}_QR.png`}
                target="_blank"
                rel="noreferrer"
                className="flex-1"
              >
                <Button className="w-full bg-orange-600 hover:bg-orange-700 text-white gap-1.5">
                  <Download className="h-4 w-4" />
                  डाउनलोड
                </Button>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Bottom Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-background/95 backdrop-blur-md border-t z-30 shadow-lg">
        <div className="container mx-auto max-w-5xl flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            सभी प्रत्याशी और अभियान सेटिंग्स को तुरंत लागू करने के लिए सेव करें
          </span>
          <Button onClick={saveAll} className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white font-semibold gap-2 shadow-sm">
            <Save className="h-4 w-4" />
            <span>💾 बदलाव सेव करें (Save Changes)</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

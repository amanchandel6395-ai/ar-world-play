import type { Candidate } from "./config";

export function resolveCandidateFromEnv(
  searchQuery?: string,
  serverCandidates?: Candidate[]
): Candidate | undefined {
  if (typeof window === "undefined") return undefined;

  const params = new URLSearchParams(searchQuery || window.location.search);
  const candidateId = params.get("candidate");
  const candName = params.get("name") || candidateId;
  const candConst = params.get("constituency");
  const candRole = params.get("role");
  const candSlogan = params.get("slogan");

  // 1. Check server config candidates
  if (candidateId && serverCandidates?.length) {
    const found = serverCandidates.find((c) => c.id === candidateId && c.active);
    if (found) return found;
  }

  // 2. Check local storage candidates saved by Admin
  try {
    const local = localStorage.getItem("zuitar_admin_candidates");
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) {
        const found = parsed.find(
          (c: any) =>
            (c.id === candidateId || c.name === candidateId || c.name === candName) &&
            c.isActive !== false
        );
        if (found) {
          return {
            id: found.id,
            name: { en: found.name, hi: found.name },
            constituency: { en: found.constituency || "Uttar Pradesh", hi: found.constituency || "उत्तर प्रदेश" },
            partyRole: { en: found.role || "प्रत्याशी", hi: found.role || "प्रत्याशी" },
            slogan: { en: found.slogan || "सबका साथ, सबका विकास", hi: found.slogan || "सबका साथ, सबका विकास" },
            photoUrl: found.photoUrl || "/assets/yogi.png",
            phone: found.phone || "9068734941",
            active: found.isActive !== false,
          };
        }
      }
    }
  } catch (e) {
    console.error("Failed to parse local candidates", e);
  }

  // 3. Dynamic candidate from query params if candidate or name is passed
  if (candName && candName !== "undefined" && candName !== "null" && candName !== "booth") {
    return {
      id: candidateId || "custom",
      name: { en: candName, hi: candName },
      constituency: { en: candConst || "उत्तर प्रदेश", hi: candConst || "उत्तर प्रदेश" },
      partyRole: { en: candRole || "भाजपा प्रत्याशी", hi: candRole || "भाजपा प्रत्याशी" },
      slogan: { en: candSlogan || "अबकी बार 400 पार, मोदी-योगी सरकार", hi: candSlogan || "अबकी बार 400 पार, मोदी-योगी सरकार" },
      photoUrl: "/assets/yogi.png",
      phone: "9068734941",
      active: true,
    };
  }

  return undefined;
}

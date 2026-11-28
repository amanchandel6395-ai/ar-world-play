import type { InteractionId } from "./config";

export function getEnhancePrompt(scene: string, interaction: InteractionId | string): string {
  if (scene === "demo") {
    return "Create a clearly AI-generated development test selfie from this customer-provided photo. Preserve the customer's identity, face, expression, pose, skin tone and clothing. Add exactly one fictional adult person with an original, ordinary appearance, standing beside the customer as if posing for a casual selfie. This fictional person must not resemble any real person, public figure, politician, celebrity, or recognizable character. Do not add political content, logos, flags, slogans, or text. Keep the customer recognizable and the result respectful.";
  }

  if (scene === "photo") {
    return "Make a subtle, faithful enhancement of this single customer photo. Improve exposure, white balance, contrast and detail. Preserve the person's exact identity, face shape, expression, pose, skin tone, clothing and all existing objects, symbols and text. Do not add or remove people or objects. Do not add political content, logos, flags or text. Do not reshape or beautify the face. Keep the result realistic and faithful to the original.";
  }

  if (scene === "modi") {
    if (interaction === "hug") {
      return "Realistic, photorealistic, high quality photo of Prime Minister Narendra Modi sharing a warm, respectful friendly hug (gale milna / embrace) with the customer. Keep the customer's exact face, identity, hair, facial features, expression, skin tone, and clothing preserved. Prime Minister Narendra Modi is styled authentically with his neat white beard, spectacles, and traditional elegant kurta jacket, smiling warmly as they embrace. Professional warm stage lighting, clean dignified background, natural perspective.";
    }
    if (interaction === "handshake") {
      return "Realistic, photorealistic, high quality photo of Prime Minister Narendra Modi shaking hands warmly and respectfully with the customer. Keep the customer's exact face, identity, hair, expression, skin tone, and clothing preserved. Prime Minister Narendra Modi is styled authentically in his classic kurta jacket and spectacles, greeting the customer with a respectful, warm smile and a firm handshake. Dignified professional lighting and natural background.";
    }
    if (interaction === "meeting") {
      return "Realistic, photorealistic, high quality photo of the customer seated in a friendly formal meeting with Prime Minister Narendra Modi, based on authentic meeting reference photographs. Keep the customer's exact face and identity preserved. Both seated in dignified chairs, conversing with warm professional expressions, elegant background with traditional decor.";
    }
    if (interaction === "scarf") {
      return "Realistic, photorealistic, high quality photo of Prime Minister Narendra Modi presenting a traditional ceremonial saffron scarf (angavastram / uttariya) to the customer in a gesture of honor and respect. Keep the customer's exact face, expression, and identity preserved. Prime Minister Narendra Modi is smiling warmly, holding or draping the saffron stole. Dignified ceremonial lighting and background.";
    }
    if (interaction === "gift") {
      return "Realistic, photorealistic, high quality photo of the customer presenting a ceremonial gift or traditional flower bouquet / memento to Prime Minister Narendra Modi, with the Prime Minister accepting it with a warm welcoming smile. Keep the customer's exact face, expression, and identity preserved. Prime Minister Narendra Modi is styled authentically with neat white beard, spectacles, and traditional elegant kurta jacket. Dignified ceremonial event lighting and background.";
    }
    return "Realistic, photorealistic, high quality photo of Prime Minister Narendra Modi standing beside the customer smiling and greeting with folded hands in namaste / posing together for a selfie. Keep the customer's exact face and identity preserved. Prime Minister Narendra Modi in his signature kurta jacket and spectacles. Warm natural lighting.";
  }

  if (scene === "yogi") {
    const yogiBuild = "Chief Minister Yogi Adityanath has his authentic fit, lean, disciplined ascetic monk physique, sharp jawline, natural athletic proportions, clean shaved head, subtle gold earrings (kundal), small red tilak on forehead, authentic saffron robes and stole. Never heavy, chubby or bloated; maintain his true fit, trim monk appearance.";
    if (interaction === "meeting") {
      return `Realistic, photorealistic, high quality photo of Chief Minister Yogi Adityanath seated in an official meeting and friendly discussion with the customer, styled after official state meeting reference photographs. ${yogiBuild} Warm respectful expression. Keep the customer's exact face, hair, and identity preserved.`;
    }
    if (interaction === "scarf") {
      return `Realistic, photorealistic, high quality photo of Chief Minister Yogi Adityanath presenting a ceremonial saffron scarf / stole to the customer in honor and welcome. ${yogiBuild} Warm respectful expression. Keep the customer's exact identity and face preserved.`;
    }
    if (interaction === "gift") {
      return `Realistic, photorealistic, high quality photo of the customer presenting a ceremonial gift, flower bouquet, or traditional memento to Chief Minister Yogi Adityanath, with the Chief Minister accepting it with a warm welcoming smile. ${yogiBuild} Keep the customer's exact face and identity preserved.`;
    }
    if (interaction === "handshake") {
      return `Realistic, photorealistic, high quality photo of Chief Minister Yogi Adityanath shaking hands warmly with the customer. ${yogiBuild} Keep the customer's exact face, hair, and identity preserved.`;
    }
    if (interaction === "hug") {
      return `Realistic, photorealistic, high quality photo of Chief Minister Yogi Adityanath sharing a warm respectful hug / friendly greeting with the customer. ${yogiBuild} Keep the customer's exact face and identity preserved.`;
    }
    return `Realistic, photorealistic, high quality photo of Chief Minister Yogi Adityanath standing with the customer in a warm, dignified friendly interaction. ${yogiBuild} Keep the customer's exact face and identity preserved.`;
  }

  if (scene === "bjp") {
    return "Enhance this vertical 9:16 customer photo with authentic BJP campaign and event styling. Drape a traditional BJP saffron and green scarf (angavastram / patka) with lotus symbol naturally over the customer's shoulders, a stylish BJP saffron cap with lotus emblem, and warm saffron and green festive stage lighting with a soft bokeh background featuring subtle saffron and green tones and the clean lotus emblem. Preserve the customer's exact identity, face, expression, and skin tone. Do not add any other people.";
  }

  return "Enhance this photo with clean, dignified lighting and natural colors while preserving all identities.";
}

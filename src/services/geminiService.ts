import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export async function verifyFace(capturedImageBase64: string, referenceImageBase64: string): Promise<boolean> {
  try {
    // Extract base64 data (remove prefix if exists)
    const capturedData = capturedImageBase64.split(',')[1] || capturedImageBase64;
    const referenceData = referenceImageBase64.split(',')[1] || referenceImageBase64;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              text: "Compare these two images. Are they of the same person? Answer with only 'YES' or 'NO'.",
            },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: capturedData,
              },
            },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: referenceData,
              },
            },
          ],
        },
      ],
    });

    const text = response.text?.trim().toUpperCase();
    return text === 'YES';
  } catch (error) {
    console.error("Face verification error:", error);
    return false;
  }
}

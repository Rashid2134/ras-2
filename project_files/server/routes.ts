import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { decryptRequestSchema } from "@shared/schema";
import { z } from "zod";

// Decryption functions
function decryptDecimal(text: string): string {
  try {
    // Handle format like \45\45\32\80\82\79\88\89
    const numbers = text.split('\\').filter(Boolean);
    return numbers.map(num => String.fromCharCode(parseInt(num))).join('');
  } catch {
    throw new Error('فشل في فك التشفير العشري');
  }
}

function decryptHex(text: string): string {
  try {
    // Remove any whitespace and convert hex to string
    const cleanHex = text.replace(/\s/g, '');
    let result = '';
    for (let i = 0; i < cleanHex.length; i += 2) {
      result += String.fromCharCode(parseInt(cleanHex.substr(i, 2), 16));
    }
    return result;
  } catch {
    throw new Error('فشل في فك التشفير السادس عشر');
  }
}

function decryptBase64(text: string): string {
  try {
    return Buffer.from(text, 'base64').toString('utf8');
  } catch {
    throw new Error('فشل في فك تشفير Base64');
  }
}

function decryptCaesar(text: string, shift: number = 3): string {
  return text.replace(/[a-zA-Z]/g, (char) => {
    const start = char <= 'Z' ? 65 : 97;
    return String.fromCharCode(((char.charCodeAt(0) - start - shift + 26) % 26) + start);
  });
}

function decryptROT13(text: string): string {
  return decryptCaesar(text, 13);
}

function decryptURL(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    throw new Error('فشل في فك تشفير URL');
  }
}

function detectEncryptionType(text: string): string {
  // Check for decimal encoding (\45\45\32...)
  if (/^\\?\d+(\\?\d+)*$/.test(text.replace(/\\/g, ''))) {
    return 'decimal';
  }
  
  // Check for hex encoding
  if (/^[0-9a-fA-F\s]+$/.test(text) && text.length % 2 === 0) {
    return 'hex';
  }
  
  // Check for Base64
  if (/^[A-Za-z0-9+/]+=*$/.test(text) && text.length % 4 === 0) {
    return 'base64';
  }
  
  // Check for URL encoding
  if (text.includes('%') && /^[A-Za-z0-9%\-_.~]+$/.test(text)) {
    return 'url';
  }
  
  // Default to text (could be Caesar or ROT13)
  return 'caesar';
}

function performDecryption(text: string, type: string, caesarShift?: number): { decoded: string; detectedType: string } {
  let detectedType = type;
  
  if (type === 'auto') {
    detectedType = detectEncryptionType(text);
  }
  
  let decoded: string;
  
  switch (detectedType) {
    case 'decimal':
      decoded = decryptDecimal(text);
      break;
    case 'hex':
      decoded = decryptHex(text);
      break;
    case 'base64':
      decoded = decryptBase64(text);
      break;
    case 'caesar':
      decoded = decryptCaesar(text, caesarShift);
      break;
    case 'rot13':
      decoded = decryptROT13(text);
      break;
    case 'url':
      decoded = decryptURL(text);
      break;
    default:
      throw new Error('نوع التشفير غير مدعوم');
  }
  
  return { decoded, detectedType };
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.txt', '.log', '.dat'];
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم. يرجى استخدام ملفات .txt, .log, أو .dat'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Decrypt text endpoint
  app.post("/api/decrypt", async (req, res) => {
    try {
      const validatedData = decryptRequestSchema.parse(req.body);
      const { text, encryptionType, caesarShift } = validatedData;
      
      const { decoded, detectedType } = performDecryption(text, encryptionType, caesarShift);
      
      // Save to session history
      const session = await storage.createDecryptionSession({
        originalText: text,
        decodedText: decoded,
        encryptionType: detectedType,
        originalLength: text.length,
        decodedLength: decoded.length,
      });
      
      res.json({
        success: true,
        decoded,
        detectedType,
        originalLength: text.length,
        decodedLength: decoded.length,
        sessionId: session.id,
      });
    } catch (error) {
      console.error('Decryption error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'حدث خطأ في فك التشفير',
      });
    }
  });

  // Decrypt file endpoint
  app.post("/api/decrypt-file", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'لم يتم رفع أي ملف',
        });
      }

      const fileContent = req.file.buffer.toString('utf8');
      const encryptionType = req.body.encryptionType || 'auto';
      const caesarShift = req.body.caesarShift ? parseInt(req.body.caesarShift) : undefined;
      
      const { decoded, detectedType } = performDecryption(fileContent, encryptionType, caesarShift);
      
      // Save to session history
      const session = await storage.createDecryptionSession({
        originalText: fileContent,
        decodedText: decoded,
        encryptionType: detectedType,
        originalLength: fileContent.length,
        decodedLength: decoded.length,
      });
      
      res.json({
        success: true,
        decoded,
        detectedType,
        originalLength: fileContent.length,
        decodedLength: decoded.length,
        fileName: req.file.originalname,
        sessionId: session.id,
      });
    } catch (error) {
      console.error('File decryption error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'حدث خطأ في فك تشفير الملف',
      });
    }
  });

  // Get session history
  app.get("/api/sessions", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const sessions = await storage.getDecryptionSessions(limit);
      
      res.json({
        success: true,
        sessions,
      });
    } catch (error) {
      console.error('Get sessions error:', error);
      res.status(500).json({
        success: false,
        error: 'حدث خطأ في جلب التاريخ',
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

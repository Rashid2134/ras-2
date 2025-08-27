import { useState, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  decryptText,
  decryptFile,
  getSessionHistory,
  downloadText,
  copyToClipboard,
  formatTimeAgo,
  getEncryptionTypeLabel,
  type DecryptionResult,
  type DecryptionSession,
} from "@/lib/decryption";
import {
  Unlock,
  Keyboard,
  Upload,
  Copy,
  Download,
  Trash2,
  Settings,
  HelpCircle,
  CheckCircle,
  AlertTriangle,
  Search,
  Loader2,
} from "lucide-react";

export default function Decoder() {
  const [activeTab, setActiveTab] = useState<"text" | "file">("text");
  const [inputText, setInputText] = useState("");
  const [autoDetect, setAutoDetect] = useState(true);
  const [encryptionType, setEncryptionType] = useState("auto");
  const [caesarShift, setCaesarShift] = useState(3);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<DecryptionResult | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get session history
  const { data: sessions = [] } = useQuery({
    queryKey: ['/api/sessions'],
    queryFn: getSessionHistory,
  });

  // Decrypt text mutation
  const decryptTextMutation = useMutation({
    mutationFn: ({ text, type, shift }: { text: string; type: string; shift?: number }) =>
      decryptText(text, type, shift),
    onSuccess: (data) => {
      setResult(data);
      if (data.success) {
        toast({
          variant: "success",
          title: "تم فك التشفير بنجاح!",
          description: `تم كشف: ${getEncryptionTypeLabel(data.detectedType || "")}`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      } else {
        toast({
          variant: "destructive",
          title: "فشل في فك التشفير",
          description: data.error,
        });
      }
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "حدث خطأ",
        description: error.message,
      });
    },
  });

  // Decrypt file mutation
  const decryptFileMutation = useMutation({
    mutationFn: ({ file, type, shift }: { file: File; type: string; shift?: number }) =>
      decryptFile(file, type, shift),
    onSuccess: (data) => {
      setResult(data);
      if (data.success) {
        toast({
          variant: "success",
          title: "تم فك تشفير الملف بنجاح!",
          description: `الملف: ${data.fileName}`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      } else {
        toast({
          variant: "destructive",
          title: "فشل في فك تشفير الملف",
          description: data.error,
        });
      }
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "حدث خطأ",
        description: error.message,
      });
    },
  });

  const handleDecrypt = useCallback(() => {
    if (activeTab === "text") {
      if (!inputText.trim()) {
        toast({
          variant: "destructive",
          title: "خطأ",
          description: "يرجى إدخال النص المراد فك تشفيره",
        });
        return;
      }
      
      decryptTextMutation.mutate({
        text: inputText,
        type: autoDetect ? "auto" : encryptionType,
        shift: encryptionType === "caesar" ? caesarShift : undefined,
      });
    } else {
      if (!selectedFile) {
        toast({
          variant: "destructive",
          title: "خطأ",
          description: "يرجى اختيار ملف لفك تشفيره",
        });
        return;
      }
      
      decryptFileMutation.mutate({
        file: selectedFile,
        type: autoDetect ? "auto" : encryptionType,
        shift: encryptionType === "caesar" ? caesarShift : undefined,
      });
    }
  }, [activeTab, inputText, selectedFile, autoDetect, encryptionType, caesarShift, decryptTextMutation, decryptFileMutation, toast]);

  const handleFileSelect = useCallback((file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "حجم الملف كبير جداً",
        description: "الحد الأقصى لحجم الملف 10 ميجابايت",
      });
      return;
    }
    
    const allowedTypes = ['.txt', '.log', '.dat'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedTypes.includes(fileExtension)) {
      toast({
        variant: "destructive",
        title: "نوع الملف غير مدعوم",
        description: "يرجى استخدام ملفات .txt, .log, أو .dat",
      });
      return;
    }
    
    setSelectedFile(file);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleCopy = useCallback(async () => {
    if (result?.decoded) {
      try {
        await copyToClipboard(result.decoded);
        toast({
          variant: "success",
          title: "تم نسخ النتيجة بنجاح!",
        });
      } catch {
        toast({
          variant: "destructive",
          title: "فشل في النسخ",
        });
      }
    }
  }, [result, toast]);

  const handleDownload = useCallback(() => {
    if (result?.decoded) {
      downloadText(result.decoded, result.fileName || "decoded_text.txt");
      toast({
        variant: "success",
        title: "تم تحميل الملف بنجاح!",
      });
    }
  }, [result, toast]);

  const isProcessing = decryptTextMutation.isPending || decryptFileMutation.isPending;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4 space-x-reverse">
              <div className="flex items-center">
                <Unlock className="text-primary text-2xl ml-3" size={24} />
                <h1 className="text-xl font-bold text-foreground">أداة فك التشفير المتقدمة</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4 space-x-reverse">
              <Button variant="ghost" size="sm" data-testid="button-help">
                <HelpCircle className="text-lg" />
              </Button>
              <Button variant="ghost" size="sm" data-testid="button-settings">
                <Settings className="text-lg" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Input Section */}
          <div className="lg:col-span-2">
            {/* Input Method Selection */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">اختر طريقة الإدخال</h2>
                
                {/* Tabs */}
                <div className="flex space-x-2 space-x-reverse mb-6 bg-muted p-1 rounded-lg">
                  <Button
                    variant={activeTab === "text" ? "default" : "ghost"}
                    onClick={() => setActiveTab("text")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === "text" ? "tab-active" : "tab-inactive"
                    }`}
                    data-testid="button-tab-text"
                  >
                    <Keyboard className="ml-2" size={16} />
                    إدخال نص
                  </Button>
                  <Button
                    variant={activeTab === "file" ? "default" : "ghost"}
                    onClick={() => setActiveTab("file")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === "file" ? "tab-active" : "tab-inactive"
                    }`}
                    data-testid="button-tab-file"
                  >
                    <Upload className="ml-2" size={16} />
                    رفع ملف
                  </Button>
                </div>

                {/* Text Input Tab */}
                {activeTab === "text" && (
                  <div className="space-y-4">
                    <Textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      className="w-full h-48 p-4 border border-input rounded-lg bg-background text-foreground placeholder-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      placeholder="أدخل النص المشفر هنا...&#10;مثال: \45\45\32\80\82\79\88\89&#10;أو: SGVsbG8gV29ybGQ=&#10;أو: 48656c6c6f20576f726c64"
                      data-testid="textarea-input"
                    />
                    
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-muted-foreground">
                        <span data-testid="text-char-count">{inputText.length}</span> حرف
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setInputText("")}
                        className="text-secondary hover:text-destructive transition-colors"
                        data-testid="button-clear-text"
                      >
                        <Trash2 className="ml-1" size={16} />
                        مسح النص
                      </Button>
                    </div>
                  </div>
                )}

                {/* File Upload Tab */}
                {activeTab === "file" && (
                  <div className="space-y-4">
                    <div
                      className={`file-drop-zone rounded-lg p-8 text-center cursor-pointer transition-all ${
                        dragOver ? "drag-over" : ""
                      }`}
                      onDrop={handleDrop}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="div-file-drop-zone"
                    >
                      <Upload className="text-4xl text-muted-foreground mb-4 mx-auto" size={48} />
                      <p className="text-lg font-medium text-foreground mb-2">اسحب الملف هنا أو انقر للاختيار</p>
                      <p className="text-sm text-muted-foreground mb-4">يدعم ملفات .txt, .log, .dat بحجم أقصى 10 ميجابايت</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.log,.dat"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                        data-testid="input-file"
                      />
                      <Button className="bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors">
                        اختيار ملف
                      </Button>
                    </div>
                    
                    {/* File Info */}
                    {selectedFile && (
                      <div className="p-4 bg-muted rounded-lg" data-testid="div-file-info">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <Upload className="text-primary ml-2" size={16} />
                            <span className="font-medium" data-testid="text-file-name">{selectedFile.name}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span data-testid="text-file-size">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Decryption Options */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">خيارات فك التشفير</h2>
                
                {/* Auto Detection */}
                <div className="flex items-center mb-4 p-3 bg-accent/10 rounded-lg border border-accent/20">
                  <Checkbox
                    id="autoDetect"
                    checked={autoDetect}
                    onCheckedChange={(checked) => setAutoDetect(!!checked)}
                    className="w-4 h-4 text-accent bg-background border-border rounded focus:ring-accent focus:ring-2"
                    data-testid="checkbox-auto-detect"
                  />
                  <Label htmlFor="autoDetect" className="mr-2 text-sm font-medium text-foreground cursor-pointer">
                    <CheckCircle className="ml-2 text-accent inline" size={16} />
                    كشف نوع التشفير تلقائياً (موصى به)
                  </Label>
                </div>

                {/* Manual Selection */}
                <div className={`space-y-3 ${autoDetect ? "opacity-50" : ""}`}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">أو اختر نوع التشفير يدوياً:</h3>
                  
                  <RadioGroup
                    value={encryptionType}
                    onValueChange={setEncryptionType}
                    disabled={autoDetect}
                    className="grid grid-cols-2 gap-3"
                  >
                    {[
                      { value: "decimal", label: "تشفير عشري (\\45\\32...)" },
                      { value: "hex", label: "تشفير سادس عشر (Hex)" },
                      { value: "base64", label: "تشفير Base64" },
                      { value: "caesar", label: "تشفير قيصر (Caesar)" },
                      { value: "rot13", label: "تشفير ROT13" },
                      { value: "url", label: "تشفير URL" },
                    ].map((option) => (
                      <div key={option.value} className="flex items-center space-x-2 space-x-reverse p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                        <RadioGroupItem
                          value={option.value}
                          id={option.value}
                          className="w-4 h-4 text-primary bg-background border-border focus:ring-primary focus:ring-2"
                          data-testid={`radio-${option.value}`}
                        />
                        <Label htmlFor={option.value} className="text-sm cursor-pointer">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {/* Decode Button */}
                <Button
                  onClick={handleDecrypt}
                  disabled={isProcessing || (activeTab === "text" && !inputText.trim()) || (activeTab === "file" && !selectedFile)}
                  className="w-full mt-6 bg-primary text-primary-foreground py-3 px-6 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center"
                  data-testid="button-decrypt"
                >
                  {isProcessing ? (
                    <Loader2 className="ml-2 animate-spin" size={20} />
                  ) : (
                    <Unlock className="ml-2" size={20} />
                  )}
                  {isProcessing ? "جاري المعالجة..." : "فك التشفير"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Results and History Section */}
          <div className="lg:col-span-1">
            {/* Processing Status */}
            {isProcessing && (
              <Card className="mb-6">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Loader2 className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary ml-3" />
                    <div>
                      <h3 className="font-medium text-foreground">جاري المعالجة...</h3>
                      <p className="text-sm text-muted-foreground">فك تشفير النص</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="bg-muted rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full transition-all duration-300 animate-pulse" style={{ width: "65%" }}></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Results */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground">النتائج</h2>
                  {result?.success && result.detectedType && (
                    <Badge className="px-3 py-1 bg-accent text-accent-foreground rounded-full text-xs font-medium" data-testid="badge-detection">
                      تم كشف: {getEncryptionTypeLabel(result.detectedType)}
                    </Badge>
                  )}
                </div>
                
                {!result && (
                  <div className="text-center py-8" data-testid="div-no-results">
                    <Search className="text-4xl text-muted-foreground mb-4 mx-auto" size={48} />
                    <p className="text-muted-foreground">لم يتم فك أي تشفير بعد</p>
                    <p className="text-sm text-muted-foreground mt-1">أدخل نصاً أو ملفاً لبدء فك التشفير</p>
                  </div>
                )}

                {result?.success && (
                  <div className="space-y-4" data-testid="div-results-content">
                    {/* Result Text */}
                    <div className="result-card p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-foreground mb-2">النص المفكوك:</h3>
                      <div className="bg-background p-3 rounded border border-border">
                        <pre className="text-sm text-foreground whitespace-pre-wrap overflow-x-auto" data-testid="text-decoded">
                          {result.decoded}
                        </pre>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-2 space-x-reverse">
                      <Button
                        onClick={handleCopy}
                        className="flex-1 bg-secondary text-secondary-foreground py-2 px-4 rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors"
                        data-testid="button-copy"
                      >
                        <Copy className="ml-1" size={16} />
                        نسخ
                      </Button>
                      <Button
                        onClick={handleDownload}
                        className="flex-1 bg-accent text-accent-foreground py-2 px-4 rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
                        data-testid="button-download"
                      >
                        <Download className="ml-1" size={16} />
                        تحميل
                      </Button>
                    </div>

                    {/* Statistics */}
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div className="text-lg font-semibold text-foreground" data-testid="text-original-length">
                            {result.originalLength}
                          </div>
                          <div className="text-xs text-muted-foreground">الطول الأصلي</div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-foreground" data-testid="text-decoded-length">
                            {result.decodedLength}
                          </div>
                          <div className="text-xs text-muted-foreground">الطول المفكوك</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {result && !result.success && (
                  <div className="text-center py-8" data-testid="div-error-result">
                    <AlertTriangle className="text-4xl text-destructive mb-4 mx-auto" size={48} />
                    <p className="text-destructive font-medium">فشل في فك التشفير</p>
                    <p className="text-sm text-muted-foreground mt-1">{result.error}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Session History */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground">تاريخ الجلسة</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => queryClient.setQueryData(['/api/sessions'], [])}
                    className="text-secondary hover:text-destructive transition-colors"
                    data-testid="button-clear-history"
                  >
                    <Trash2 className="ml-1" size={16} />
                    مسح
                  </Button>
                </div>
                
                <div className="space-y-3" data-testid="div-history-content">
                  {sessions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">لا يوجد تاريخ</p>
                  ) : (
                    sessions.map((session: DecryptionSession) => (
                      <div
                        key={session.id}
                        className="p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => setResult({
                          success: true,
                          decoded: session.decodedText,
                          detectedType: session.encryptionType,
                          originalLength: session.originalLength,
                          decodedLength: session.decodedLength,
                        })}
                        data-testid={`div-history-item-${session.id}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary" className="text-xs font-medium">
                            {getEncryptionTypeLabel(session.encryptionType)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(session.createdAt || "")}
                          </span>
                        </div>
                        <p className="text-sm text-foreground truncate">
                          {session.decodedText.substring(0, 50)}...
                        </p>
                        <div className="text-xs text-muted-foreground mt-1">
                          {session.originalLength} ← {session.decodedLength} حرف
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Help Section */}
        <Card className="mt-8">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              <HelpCircle className="text-primary ml-2 inline" size={20} />
              أنواع التشفير المدعومة
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: "التشفير العشري", description: "نص مشفر بصيغة أرقام عشرية مفصولة بعلامة \\", example: "\\45\\45\\32\\80\\82\\79" },
                { title: "التشفير السادس عشر", description: "نص مشفر بنظام الأرقام السادس عشر", example: "48656c6c6f20576f726c64" },
                { title: "تشفير Base64", description: "تشفير النصوص إلى صيغة Base64", example: "SGVsbG8gV29ybGQ=" },
                { title: "تشفير قيصر", description: "إزاحة الأحرف بعدد ثابت من المواضع", example: "Khoor Zruog (shift 3)" },
                { title: "تشفير ROT13", description: "إزاحة الأحرف الإنجليزية 13 موضعاً", example: "Uryyb Jbeyq" },
                { title: "تشفير URL", description: "تشفير النصوص لاستخدامها في URLs", example: "Hello%20World" },
              ].map((type, index) => (
                <div key={index} className="space-y-2">
                  <h3 className="font-medium text-foreground">{type.title}</h3>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                  <code className="text-xs bg-muted p-1 rounded block">{type.example}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

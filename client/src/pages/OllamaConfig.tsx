import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, CheckCircle2, XCircle, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function OllamaConfig() {
  const [, navigate] = useLocation();
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle");

  const { data: config, isLoading } = trpc.ollama.getConfig.useQuery();
  
  const [formData, setFormData] = useState({
    baseUrl: config?.baseUrl || "http://localhost:11434",
    model: config?.model || "llama2",
    temperature: config?.temperature || "0.3",
    topP: config?.topP || "0.9",
    timeoutSeconds: config?.timeoutSeconds || 60,
  });

  const updateConfigMutation = trpc.ollama.updateConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuration saved successfully");
    },
    onError: (error) => {
      toast.error(`Failed to save configuration: ${error.message}`);
    },
  });

  const testConnectionMutation = trpc.ollama.testConnection.useMutation({
    onSuccess: () => {
      setConnectionStatus("success");
      toast.success("Connection successful");
    },
    onError: (error) => {
      setConnectionStatus("error");
      toast.error(`Connection failed: ${error.message}`);
    },
    onSettled: () => {
      setTestingConnection(false);
    },
  });

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus("idle");
    await testConnectionMutation.mutateAsync({ serverUrl: formData.baseUrl });
  };

  const handleSave = async () => {
    await updateConfigMutation.mutateAsync(formData);
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => navigate("/projects")}
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white">Ollama Configuration</h1>
                <p className="text-sm text-slate-400 mt-1">Configure LLM settings for document processing</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-4xl">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Connection Settings */}
            <Card className="p-6 bg-slate-900/50 border-slate-800">
              <div className="flex items-center gap-3 mb-6">
                <Settings className="h-6 w-6 text-orange-400" />
                <h2 className="text-xl font-bold text-white">Connection Settings</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="baseUrl" className="text-slate-300">Ollama Server URL</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="baseUrl"
                      value={formData.baseUrl}
                      onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                      placeholder="http://localhost:11434"
                      className="bg-slate-800 border-slate-700 text-white flex-1"
                    />
                    <Button
                      onClick={handleTestConnection}
                      disabled={testingConnection}
                      variant="outline"
                      className="border-slate-700 hover:bg-slate-800"
                    >
                      {testingConnection ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Testing...
                        </>
                      ) : connectionStatus === "success" ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-400" />
                          Connected
                        </>
                      ) : connectionStatus === "error" ? (
                        <>
                          <XCircle className="h-4 w-4 mr-2 text-red-400" />
                          Failed
                        </>
                      ) : (
                        "Test Connection"
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-slate-400 mt-2">
                    URL of your Ollama server instance (default: http://localhost:11434)
                  </p>
                </div>
              </div>
            </Card>

            {/* Model Settings */}
            <Card className="p-6 bg-slate-900/50 border-slate-800">
              <h2 className="text-xl font-bold text-white mb-6">Model Settings</h2>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="model" className="text-slate-300">Model</Label>
                  <Select value={formData.model} onValueChange={(value) => setFormData({ ...formData, model: value })}>
                    <SelectTrigger className="mt-2 bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="llama2">Llama 2</SelectItem>
                      <SelectItem value="llama3">Llama 3</SelectItem>
                      <SelectItem value="mistral">Mistral</SelectItem>
                      <SelectItem value="mixtral">Mixtral</SelectItem>
                      <SelectItem value="codellama">Code Llama</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-slate-400 mt-2">
                    Select the Ollama model to use for fact extraction
                  </p>
                </div>

                <div>
                  <Label htmlFor="temperature" className="text-slate-300">Temperature</Label>
                  <Input
                    id="temperature"
                    type="text"
                    value={formData.temperature}
                    onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                    className="mt-2 bg-slate-800 border-slate-700 text-white"
                  />
                  <p className="text-sm text-slate-400 mt-2">
                    Controls randomness (e.g., "0.3" = more deterministic, "0.9" = more creative)
                  </p>
                </div>

                <div>
                  <Label htmlFor="topP" className="text-slate-300">Top P</Label>
                  <Input
                    id="topP"
                    type="text"
                    value={formData.topP}
                    onChange={(e) => setFormData({ ...formData, topP: e.target.value })}
                    className="mt-2 bg-slate-800 border-slate-700 text-white"
                  />
                  <p className="text-sm text-slate-400 mt-2">
                    Nucleus sampling parameter (e.g., "0.9")
                  </p>
                </div>

                <div>
                  <Label htmlFor="timeoutSeconds" className="text-slate-300">Timeout (seconds)</Label>
                  <Input
                    id="timeoutSeconds"
                    type="number"
                    min="10"
                    max="300"
                    step="10"
                    value={formData.timeoutSeconds}
                    onChange={(e) => setFormData({ ...formData, timeoutSeconds: parseInt(e.target.value) })}
                    className="mt-2 bg-slate-800 border-slate-700 text-white"
                  />
                  <p className="text-sm text-slate-400 mt-2">
                    Maximum time to wait for LLM response
                  </p>
                </div>
              </div>
            </Card>



            {/* Save Button */}
            <div className="flex justify-end gap-3">
              <Button
                onClick={() => navigate("/projects")}
                variant="outline"
                className="border-slate-700 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateConfigMutation.isPending}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {updateConfigMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Configuration"
                )}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

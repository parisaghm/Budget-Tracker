import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

export function InstallAppButton() {
  const { canInstall, install } = useInstallPrompt();

  if (!canInstall) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={async () => {
        const accepted = await install();
        if (accepted) {
          toast.success("Budget Tracker installed");
          return;
        }
        toast.message("Install canceled");
      }}
    >
      <Download className="h-4 w-4" />
      Install app
    </Button>
  );
}

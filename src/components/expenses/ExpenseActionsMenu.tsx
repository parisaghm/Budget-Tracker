import { useState } from "react";
import { MoreHorizontal, PencilLine, Tags, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CategoryEmojiIcon } from "@/components/icons/CategoryEmojiIcon";
import type { Category, CategoryDef, Expense } from "@/types/finance";
import { cn } from "@/lib/utils";

interface ExpenseActionsMenuProps {
  expense: Expense;
  categories: CategoryDef[];
  onEdit: () => void;
  onChangeCategory: (category: Category) => void | Promise<void>;
  onDelete: () => void;
}

export function ExpenseActionsMenu({
  expense,
  categories,
  onEdit,
  onChangeCategory,
  onDelete,
}: ExpenseActionsMenuProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleCategoryPick = async (category: Category) => {
    if (category === expense.category || isUpdating) return;
    setIsUpdating(true);
    try {
      await Promise.resolve(onChangeCategory(category));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          aria-label="Expense actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl border-border">
        <DropdownMenuItem className="cursor-pointer gap-2 rounded-lg" onSelect={() => onEdit()}>
          <PencilLine className="h-4 w-4" aria-hidden />
          Edit expense
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer gap-2 rounded-lg" disabled={isUpdating}>
            <Tags className="h-4 w-4" aria-hidden />
            Change category
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="max-h-64 w-56 overflow-y-auto rounded-xl border-border">
              {categories.map((cat) => {
                const selected = cat.value === expense.category;
                return (
                  <DropdownMenuItem
                    key={cat.value}
                    disabled={isUpdating}
                    className={cn(
                      "cursor-pointer gap-2 rounded-lg",
                      selected && "bg-accent text-primary",
                    )}
                    onSelect={() => void handleCategoryPick(cat.value)}
                  >
                    <CategoryEmojiIcon
                      categoryValue={cat.value}
                      iconKey={cat.iconKey}
                      label={cat.label}
                      decorative
                      className="h-7 w-7"
                      iconClassName="h-4 w-4"
                    />
                    {cat.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer gap-2 rounded-lg text-destructive focus:text-destructive"
          onSelect={() => onDelete()}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          Delete expense
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

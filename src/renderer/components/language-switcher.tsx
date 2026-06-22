// abstract: Reusable interface language menu.
// out_of_scope: Preference storage, IPC wiring internals, and translation dictionary ownership.

import { Check, Globe } from "lucide-react";
import {
  APP_LANGUAGE_REGISTRY,
  type AppLanguage,
  SUPPORTED_APP_LANGUAGES,
} from "../../shared/language.js";
import type { RendererCopy } from "../i18n.js";
import { Button } from "./ui/button.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip.js";

type LanguageSwitcherProps = {
  language: AppLanguage;
  copy: RendererCopy["language"];
  onLanguageChange: (language: AppLanguage) => void;
};

export function LanguageSwitcher({ copy, language, onLanguageChange }: LanguageSwitcherProps) {
  return (
    <DropdownMenu>
      <Tooltip>
        <DropdownMenuTrigger asChild>
          <TooltipTrigger asChild>
            <Button aria-label={copy.label} size="icon" type="button" variant="secondary">
              <Globe className="h-4 w-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
        </DropdownMenuTrigger>
        <TooltipContent>{copy.tooltip}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        {SUPPORTED_APP_LANGUAGES.map((option) => (
          <DropdownMenuItem key={option} onSelect={() => onLanguageChange(option)}>
            <span className="w-5">
              {option === language ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
            </span>
            {APP_LANGUAGE_REGISTRY[option].nativeName}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

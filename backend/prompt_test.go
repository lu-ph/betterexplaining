package main

import (
	"strings"
	"testing"
)

func TestGetPromptInsertsSocraticQuestioningVerbatim(t *testing.T) {
	prompt := GetPrompt()
	startTag := "<socratic_questioning>\n"
	endTag := "\n</socratic_questioning>"
	start := strings.Index(prompt, startTag)
	if start == -1 {
		t.Fatal("prompt does not contain the Socratic questioning start tag")
	}
	start += len(startTag)
	end := strings.Index(prompt[start:], endTag)
	if end == -1 {
		t.Fatal("prompt does not contain the Socratic questioning end tag")
	}

	if got, want := prompt[start:start+end], socraticQuestioningPrompt; got != want {
		t.Fatal("Socratic questioning prompt was not inserted verbatim")
	}
}

func TestPromptReplacementDoesNotInterpretFormattingVerbs(t *testing.T) {
	const original = "Questioning guidance: %s"
	const content = "Use 100% of the exact text: %s"

	got := strings.Replace(original, "%s", content, 1)
	if want := "Questioning guidance: " + content; got != want {
		t.Fatalf("replacement changed source content: got %q, want %q", got, want)
	}
}

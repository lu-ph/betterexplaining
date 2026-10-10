package main

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/png"
	"strings"
	"testing"

	"github.com/cloudwego/eino/schema"
)

func TestConvertMessagePayloadImageUsesDataURL(t *testing.T) {
	var imageBytes bytes.Buffer
	if err := png.Encode(&imageBytes, image.NewRGBA(image.Rect(0, 0, 2, 2))); err != nil {
		t.Fatalf("encode test image: %v", err)
	}
	imageDataURL := fmt.Sprintf(
		"data:image/png;base64,%s",
		base64.StdEncoding.EncodeToString(imageBytes.Bytes()),
	)

	message, err := convertMessagePayload(MessagePayload{
		Role:  "user",
		Image: imageDataURL,
	})
	if err != nil {
		t.Fatalf("convert image message: %v", err)
	}
	if message.Role != schema.User {
		t.Fatalf("expected user role, got %q", message.Role)
	}
	if message.Content != "" {
		t.Fatalf("expected image-only message content to be empty, got %q", message.Content)
	}
	if len(message.UserInputMultiContent) != 1 {
		t.Fatalf("expected one image part, got %d parts", len(message.UserInputMultiContent))
	}

	imagePart := message.UserInputMultiContent[0]
	if imagePart.Type != schema.ChatMessagePartTypeImageURL {
		t.Fatalf("expected image URL part, got %q", imagePart.Type)
	}
	if imagePart.Image == nil || imagePart.Image.URL == nil {
		t.Fatal("expected image URL to be set")
	}
	if !strings.HasPrefix(*imagePart.Image.URL, "data:image/jpeg;base64,") {
		t.Fatalf("expected resized JPEG data URL, got %q", (*imagePart.Image.URL)[:min(40, len(*imagePart.Image.URL))])
	}
}

package main

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"strings"

	"github.com/disintegration/imaging"
)

const (
	softMaxLongSide = 2048
	jpegQuality     = 85
)

func ResizeImageToLimit(src string) (base64Str string, mimeType string, err error) {
	var imgData []byte

	if strings.HasPrefix(src, "data:image/") {
		parts := strings.SplitN(src, ",", 2)
		if len(parts) != 2 {
			return "", "", fmt.Errorf("invalid data url")
		}
		imgData, err = base64.StdEncoding.DecodeString(parts[1])
		if err != nil {
			return "", "", fmt.Errorf("decode base64 from data url: %w", err)
		}
	} else {
		imgData, err = base64.StdEncoding.DecodeString(src)
		if err != nil {
			return "", "", fmt.Errorf("decode base64: %w", err)
		}
	}

	img, _, err := image.Decode(bytes.NewReader(imgData))
	if err != nil {
		return "", "", fmt.Errorf("decode image: %w", err)
	}

	bounds := img.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	if w > softMaxLongSide || h > softMaxLongSide {
		img = imaging.Fit(img, softMaxLongSide, softMaxLongSide, imaging.Lanczos)
	}

	var buf bytes.Buffer
	if err := imaging.Encode(&buf, img, imaging.JPEG, imaging.JPEGQuality(jpegQuality)); err != nil {
		return "", "", fmt.Errorf("encode jpeg: %w", err)
	}

	return base64.StdEncoding.EncodeToString(buf.Bytes()), "image/jpeg", nil
}
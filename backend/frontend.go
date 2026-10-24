package main

import (
	"io/fs"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// registerEmbeddedFrontend serves built files and the React SPA fallback. The
// public Welcome entry is a separate Vite document so it can render without JS
// and without loading the authenticated Console bundle.
func registerEmbeddedFrontend(router *gin.Engine, embedded fs.FS) error {
	staticFS, err := fs.Sub(embedded, "web")
	if err != nil {
		return err
	}
	indexFile, err := staticFS.Open("index.html")
	if err != nil {
		return err
	}
	if err := indexFile.Close(); err != nil {
		return err
	}

	fileServer := http.FileServer(http.FS(staticFS))
	router.NoRoute(func(c *gin.Context) {
		requestPath := c.Request.URL.Path
		if requestPath == "/welcome" {
			c.Redirect(http.StatusPermanentRedirect, "/welcome/")
			return
		}

		filePath := strings.TrimPrefix(requestPath, "/")
		file, err := staticFS.Open(filePath)
		if err != nil && strings.HasSuffix(requestPath, "/") {
			file, err = staticFS.Open(filePath + "index.html")
		}
		if err == nil {
			_ = file.Close()
			fileServer.ServeHTTP(c.Writer, c.Request)
			return
		}

		indexContent, err := fs.ReadFile(staticFS, "index.html")
		if err != nil {
			c.Status(http.StatusInternalServerError)
			return
		}
		c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
		c.Header("Pragma", "no-cache")
		c.Header("Expires", "0")
		c.Data(http.StatusOK, "text/html; charset=utf-8", indexContent)
	})
	return nil
}

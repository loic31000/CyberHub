package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
)

func performCVERequest(t *testing.T, router *gin.Engine, method, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	encoded, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(encoded))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	return recorder
}

func cveCount(t *testing.T, cveID string) int64 {
	t.Helper()
	var count int64
	if err := store.DB.Model(&models.CVEEntry{}).Where("cve_id = ?", cveID).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	return count
}

func TestCreateCVEValidatesFrontendCVEIDFormat(t *testing.T) {
	for i, cveID := range []string{"CVE-2024-1234", "CVE-2024-12345"} {
		t.Run(cveID, func(t *testing.T) {
			path := fmt.Sprintf("/api/cve-%d", i)
			router := newTestRouter(http.MethodPost, path, CreateCVE)
			recorder := performCVERequest(t, router, http.MethodPost, path, models.CVECreateRequest{CVEID: cveID})
			if recorder.Code != http.StatusCreated {
				t.Fatalf("got status %d, want %d; body: %s", recorder.Code, http.StatusCreated, recorder.Body.String())
			}
			if got := cveCount(t, cveID); got != 1 {
				t.Fatalf("got %d stored rows, want 1", got)
			}
		})
	}
}

func TestCreateCVERejectsInvalidCVEIDWithoutWriting(t *testing.T) {
	for i, cveID := range []string{"CVE-24-1234", "CVE-2024-123", "cve-2024-1234", " CVE-2024-1234"} {
		t.Run(fmt.Sprintf("case-%d", i), func(t *testing.T) {
			path := fmt.Sprintf("/api/cve-invalid-%d", i)
			router := newTestRouter(http.MethodPost, path, CreateCVE)
			recorder := performCVERequest(t, router, http.MethodPost, path, models.CVECreateRequest{CVEID: cveID})
			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("got status %d, want %d; body: %s", recorder.Code, http.StatusBadRequest, recorder.Body.String())
			}
			var response map[string]string
			if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
				t.Fatal(err)
			}
			if response["error"] != models.CVEIDFormatError {
				t.Fatalf("got error %q, want %q", response["error"], models.CVEIDFormatError)
			}
			if got := cveCount(t, cveID); got != 0 {
				t.Fatalf("invalid ID created %d database rows", got)
			}
		})
	}
}

func TestUpdateCVEValidatesNewCVEIDAndPreservesExistingEntry(t *testing.T) {
	entry := models.CVEEntry{CVEID: "CVE-2024-9876", Description: "before"}
	if err := store.DB.Create(&entry).Error; err != nil {
		t.Fatal(err)
	}
	router := newTestRouter(http.MethodPut, "/api/cve/:id", UpdateCVE)

	valid := performCVERequest(t, router, http.MethodPut, fmt.Sprintf("/api/cve/%d", entry.ID), models.CVECreateRequest{
		CVEID: entry.CVEID, Description: "after",
	})
	if valid.Code != http.StatusOK {
		t.Fatalf("valid update got status %d, want %d; body: %s", valid.Code, http.StatusOK, valid.Body.String())
	}
	updated, err := store.GetCVEByID(entry.ID)
	if err != nil {
		t.Fatal(err)
	}
	if updated.Description != "after" {
		t.Fatalf("valid update did not apply: description = %q", updated.Description)
	}

	invalid := performCVERequest(t, router, http.MethodPut, fmt.Sprintf("/api/cve/%d", entry.ID), models.CVECreateRequest{
		CVEID: "not-a-cve", Description: "must not be written",
	})
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid update got status %d, want %d; body: %s", invalid.Code, http.StatusBadRequest, invalid.Body.String())
	}
	updated, err = store.GetCVEByID(entry.ID)
	if err != nil {
		t.Fatal(err)
	}
	if updated.Description != "after" || updated.CVEID != entry.CVEID {
		t.Fatalf("invalid update changed the row: %#v", updated)
	}
}

func TestUpdateCVEPreservesUnchangedLegacyCVEID(t *testing.T) {
	entry := models.CVEEntry{CVEID: "legacy-id", Description: "before"}
	if err := store.DB.Create(&entry).Error; err != nil {
		t.Fatal(err)
	}
	router := newTestRouter(http.MethodPut, "/api/cve/:id", UpdateCVE)
	recorder := performCVERequest(t, router, http.MethodPut, fmt.Sprintf("/api/cve/%d", entry.ID), models.CVECreateRequest{
		CVEID: entry.CVEID, Description: "after",
	})
	if recorder.Code != http.StatusOK {
		t.Fatalf("unchanged legacy ID update got status %d, want %d; body: %s", recorder.Code, http.StatusOK, recorder.Body.String())
	}
	updated, err := store.GetCVEByID(entry.ID)
	if err != nil {
		t.Fatal(err)
	}
	if updated.CVEID != entry.CVEID || updated.Description != "after" {
		t.Fatalf("legacy entry was not preserved during update: %#v", updated)
	}
}

func TestImportNVDRejectsInvalidIDBeforeWritingAnyItem(t *testing.T) {
	const validID = "CVE-2024-24680"
	body := `{"vulnerabilities":[{"cve":{"id":"` + validID + `"}},{"cve":{"id":"invalid"}}]}`
	router := newTestRouter(http.MethodPost, "/api/cve/import-nvd", ImportNVD)
	req := httptest.NewRequest(http.MethodPost, "/api/cve/import-nvd", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("got status %d, want %d; body: %s", recorder.Code, http.StatusBadRequest, recorder.Body.String())
	}
	if got := cveCount(t, validID); got != 0 {
		t.Fatalf("valid item preceding invalid item created %d rows", got)
	}
}

func TestImportNVDStoreSkipsInvalidExternalIDs(t *testing.T) {
	var item models.NVDImportItem
	if err := json.Unmarshal([]byte(`{"cve":{"id":"not-a-cve"}}`), &item); err != nil {
		t.Fatal(err)
	}
	created, skipped, err := store.ImportNVD([]models.NVDImportItem{item})
	if err != nil {
		t.Fatal(err)
	}
	if created != 0 || skipped != 1 {
		t.Fatalf("got created=%d skipped=%d, want created=0 skipped=1", created, skipped)
	}
	if got := cveCount(t, item.CVE.ID); got != 0 {
		t.Fatalf("invalid imported ID created %d rows", got)
	}
}

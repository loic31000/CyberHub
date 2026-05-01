package models

import "time"

type CVESeverity string

const (
	SeverityCritical CVESeverity = "critical"
	SeverityHigh     CVESeverity = "high"
	SeverityMedium   CVESeverity = "medium"
	SeverityLow      CVESeverity = "low"
	SeverityNone     CVESeverity = "none"
)

type CVEStatus string

const (
	CVEStatusNew      CVEStatus = "new"
	CVEStatusAnalyzed CVEStatus = "analyzed"
	CVEStatusPatched  CVEStatus = "patched"
	CVEStatusNA       CVEStatus = "na"
)

// CVEEntry représente une vulnérabilité indexée localement
type CVEEntry struct {
	ID          uint        `json:"id"          gorm:"primaryKey;autoIncrement"`
	CVEID       string      `json:"cve_id"      gorm:"uniqueIndex;not null"`
	Description string      `json:"description"`
	CVSSScore   float64     `json:"cvss_score"  gorm:"default:0"`
	Severity    CVESeverity `json:"severity"    gorm:"default:none"`
	Products    string      `json:"products"`   // CSV : produits affectés
	Status      CVEStatus   `json:"status"      gorm:"default:new"`
	Notes       string      `json:"notes"`
	PublishedAt time.Time   `json:"published_at"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

type CVECreateRequest struct {
	CVEID       string      `json:"cve_id"      binding:"required"`
	Description string      `json:"description"`
	CVSSScore   float64     `json:"cvss_score"`
	Severity    CVESeverity `json:"severity"`
	Products    string      `json:"products"`
	Status      CVEStatus   `json:"status"`
	Notes       string      `json:"notes"`
	PublishedAt time.Time   `json:"published_at"`
}

// NVDImportItem est un élément du format JSON NVD 2.0 (nvd.nist.gov)
type NVDImportItem struct {
	CVE struct {
		ID           string `json:"id"`
		Descriptions []struct {
			Lang  string `json:"lang"`
			Value string `json:"value"`
		} `json:"descriptions"`
		Metrics struct {
			V31 []struct {
				CVSSData struct {
					BaseScore    float64 `json:"baseScore"`
					BaseSeverity string  `json:"baseSeverity"`
				} `json:"cvssData"`
			} `json:"cvssMetricV31"`
			V30 []struct {
				CVSSData struct {
					BaseScore    float64 `json:"baseScore"`
					BaseSeverity string  `json:"baseSeverity"`
				} `json:"cvssData"`
			} `json:"cvssMetricV30"`
			V2 []struct {
				CVSSData struct {
					BaseScore float64 `json:"baseScore"`
				} `json:"cvssData"`
				BaseSeverity string `json:"baseSeverity"`
			} `json:"cvssMetricV2"`
		} `json:"metrics"`
		Published string `json:"published"`
	} `json:"cve"`
}

type NVDImportRequest struct {
	Vulnerabilities []NVDImportItem `json:"vulnerabilities"`
}

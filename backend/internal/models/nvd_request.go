package models

type NVDOnlineRequest struct {
	// Date de début au format "2024-01-01T00:00:00.000Z"
	PubStartDate string `json:"pub_start_date"`
	// Date de fin (optionnelle)
	PubEndDate string `json:"pub_end_date,omitempty"`
	// Score CVSS minimal (ex: 7.0)
	CVSSMin float64 `json:"cvss_min"`
	// Mots-clés dans la description ou le titre (optionnel)
	Keyword string `json:"keyword,omitempty"`
	// Nombre maximum de résultats (1-2000, défaut 100)
	ResultsPerPage int `json:"results_per_page"`
	// Page (pour pagination, défaut 1)
	Page int `json:"page"`
	// MaxPages limite le nombre de pages importées (0 = illimité)
	MaxPages int `json:"max_pages,omitempty"`
}

// NVDOnlineResponse correspond exactement à la réponse de l'API NVD v2.
// Seuls les champs nécessaires à l'import sont conservés.
type NVDOnlineResponse struct {
	TotalResults    int             `json:"totalResults"`
	StartIndex      int             `json:"startIndex"`
	ItemsPerPage    int             `json:"itemsPerPage"`
	Vulnerabilities []NVDImportItem `json:"vulnerabilities"`
}

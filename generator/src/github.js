/**
 * GitHub API Integration for publishing property sites
 */

const { Octokit } = require('octokit');

class GitHubPublisher {
  constructor(config) {
    this.octokit = new Octokit({ auth: config.token });
    this.owner = config.owner;
    this.repo = config.repo;
    this.branch = config.branch || 'main';
    this.pagesBaseUrl = config.pagesBaseUrl || `https://${config.owner}.github.io/${config.repo}`;
  }

  /**
   * Upload a file to the repository
   */
  async uploadFile(path, content, message, isBase64 = false) {
    try {
      // Check if file already exists
      let sha;
      try {
        const { data } = await this.octokit.rest.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path,
          ref: this.branch
        });
        sha = data.sha;
      } catch (e) {
        // File doesn't exist, that's fine
      }

      // Create or update file
      const response = await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path,
        message,
        content: isBase64 ? content : Buffer.from(content).toString('base64'),
        branch: this.branch,
        ...(sha && { sha })
      });

      return response.data;
    } catch (error) {
      console.error('Error uploading file:', error.message);
      throw error;
    }
  }

  /**
   * Upload multiple files in a single commit using the Git Data API
   */
  async uploadMultipleFiles(files, commitMessage) {
    try {
      // Get the current commit SHA for the branch
      const { data: refData } = await this.octokit.rest.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${this.branch}`
      });
      const currentCommitSha = refData.object.sha;

      // Get the tree SHA from the current commit
      const { data: commitData } = await this.octokit.rest.git.getCommit({
        owner: this.owner,
        repo: this.repo,
        commit_sha: currentCommitSha
      });
      const baseTreeSha = commitData.tree.sha;

      // Create blobs for each file
      const blobs = await Promise.all(
        files.map(async (file) => {
          const { data: blobData } = await this.octokit.rest.git.createBlob({
            owner: this.owner,
            repo: this.repo,
            content: file.isBase64 ? file.content : Buffer.from(file.content).toString('base64'),
            encoding: 'base64'
          });
          return {
            path: file.path,
            mode: '100644',
            type: 'blob',
            sha: blobData.sha
          };
        })
      );

      // Create a new tree
      const { data: treeData } = await this.octokit.rest.git.createTree({
        owner: this.owner,
        repo: this.repo,
        base_tree: baseTreeSha,
        tree: blobs
      });

      // Create a new commit
      const { data: newCommitData } = await this.octokit.rest.git.createCommit({
        owner: this.owner,
        repo: this.repo,
        message: commitMessage,
        tree: treeData.sha,
        parents: [currentCommitSha]
      });

      // Update the branch reference
      await this.octokit.rest.git.updateRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${this.branch}`,
        sha: newCommitData.sha
      });

      return newCommitData;
    } catch (error) {
      console.error('Error uploading multiple files:', error.message);
      throw error;
    }
  }

  /**
   * Publish a property site with all its assets
   */
  async publishPropertySite(propertySlug, htmlContent, images = []) {
    const files = [
      {
        path: `properties/${propertySlug}/index.html`,
        content: htmlContent,
        isBase64: false
      }
    ];

    // Add images if they're being stored in the repo
    for (const image of images) {
      if (image.base64Content) {
        files.push({
          path: `properties/${propertySlug}/images/${image.filename}`,
          content: image.base64Content,
          isBase64: true
        });
      }
    }

    const commitMessage = `Add property site: ${propertySlug}`;
    await this.uploadMultipleFiles(files, commitMessage);

    return {
      url: `${this.pagesBaseUrl}/properties/${propertySlug}/`,
      path: `properties/${propertySlug}/`
    };
  }

  /**
   * Check if GitHub Pages is enabled
   */
  async checkPagesStatus() {
    try {
      const { data } = await this.octokit.rest.repos.getPages({
        owner: this.owner,
        repo: this.repo
      });
      return {
        enabled: true,
        url: data.html_url,
        status: data.status
      };
    } catch (error) {
      if (error.status === 404) {
        return { enabled: false };
      }
      throw error;
    }
  }

  /**
   * List all property sites
   */
  async listPropertySites() {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: 'properties',
        ref: this.branch
      });

      if (Array.isArray(data)) {
        return data
          .filter(item => item.type === 'dir')
          .map(item => ({
            slug: item.name,
            url: `${this.pagesBaseUrl}/properties/${item.name}/`
          }));
      }
      return [];
    } catch (error) {
      if (error.status === 404) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Delete a property site
   */
  async deletePropertySite(propertySlug) {
    try {
      // Get all files in the property directory
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: `properties/${propertySlug}`,
        ref: this.branch
      });

      const files = Array.isArray(data) ? data : [data];

      // Delete each file
      for (const file of files) {
        await this.octokit.rest.repos.deleteFile({
          owner: this.owner,
          repo: this.repo,
          path: file.path,
          message: `Delete property site: ${propertySlug}`,
          sha: file.sha,
          branch: this.branch
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting property site:', error.message);
      throw error;
    }
  }
}

module.exports = { GitHubPublisher };
